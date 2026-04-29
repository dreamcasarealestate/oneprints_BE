import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatusLog } from './order-status-log.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { DispatchOrderDto } from './dto/dispatch-order.dto';
import { UpdateOrderShippingAddressDto } from './dto/update-shipping-address.dto';
import { BranchesService } from '../branch/branch.service';
import { PincodeGeoService } from '../branch/pincode-geo.service';
import { NotificationsService } from '../notification/notifications.service';
import { MailService } from '../mail/mail.service';
import { Address } from '../address/address.entity';
import { User } from '../user/user.entity';
import { UserKind } from '../user/user-kind.enum';
import {
  isBranchAdminRole,
  isStaffOperationRole,
} from '../user/roles.util';
import { normalizeKnownUserKind } from '../user/user-kind.util';

const STATUS_LABELS: Record<string, string> = {
  order_placed: 'Order placed',
  payment_pending: 'Payment pending',
  payment_confirmed: 'Payment confirmed',
  design_pending: 'Design pending',
  in_production: 'In production',
  qc_check: 'Quality check',
  ready_for_dispatch: 'Ready for dispatch',
  dispatched: 'Dispatched',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  return_requested: 'Return requested',
  refunded: 'Refunded',
};

/**
 * Statuses where the customer can still safely change the shipping
 * address. Once the order has been picked up for production it
 * either has a printed dispatch note already or is moments away
 * from one — at which point a late address swap risks a wrong
 * delivery. Mirrors the FE gate in `canEditShippingAddress`.
 */
const SHIPPING_ADDRESS_EDITABLE_STATUSES: ReadonlySet<string> = new Set([
  'order_placed',
  'payment_pending',
  'payment_confirmed',
  'design_pending',
]);

/** Lowercased trim — used when looking up matching saved addresses. */
function fold(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Returns true when the two stored addresses look like the same
 * physical place. We tolerate casing/whitespace differences so a
 * user editing "Plot 12 " into "plot 12" still matches the saved row.
 */
function addressMatches(
  saved: Address,
  draft: UpdateOrderShippingAddressDto,
): boolean {
  return (
    fold(saved.addressLine1) === fold(draft.addressLine1) &&
    fold(saved.addressLine2 ?? '') === fold(draft.addressLine2 ?? '') &&
    fold(saved.city) === fold(draft.city) &&
    fold(saved.state) === fold(draft.state) &&
    fold(saved.pinCode) === fold(draft.pinCode)
  );
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemsRepo: Repository<OrderItem>,
    @InjectRepository(OrderStatusLog)
    private readonly logRepo: Repository<OrderStatusLog>,
    @InjectRepository(Address)
    private readonly addressesRepo: Repository<Address>,
    private readonly branchesService: BranchesService,
    private readonly pincodeGeo: PincodeGeoService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  private async appendLog(
    orderId: string,
    from: string | null,
    to: string,
    actorId: string | null,
    note?: string,
  ) {
    const log = this.logRepo.create({
      orderId,
      fromStatus: from,
      toStatus: to,
      actorId,
      note: note ?? null,
    });
    await this.logRepo.save(log);
  }

  /**
   * Generate a short, human-friendly, low-collision order code.
   * Format: `OPR-YYMMDD-XXXXXX` where the suffix is base32 from
   * `crypto.randomBytes`. Retries on the unlikely DB unique clash.
   */
  private async generateOrderNumber(): Promise<string> {
    const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const now = new Date();
      const yy = String(now.getFullYear() % 100).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const bytes = randomBytes(4);
      let suffix = '';
      for (let i = 0; i < 6; i += 1) {
        suffix += ALPHABET[bytes[i % bytes.length] % ALPHABET.length];
      }
      const candidate = `OPR-${yy}${mm}${dd}-${suffix}`;
      const clash = await this.ordersRepo.findOne({
        where: { orderNumber: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    return `OPR-${Date.now().toString(36).toUpperCase()}`;
  }

  /**
   * Generate `orderNumber` for any rows that pre-date the column.
   * Idempotent and intentionally cheap — runs once per list/detail
   * fetch but only persists rows that are actually missing a number.
   */
  private async backfillOrderNumbers(orders: Order[]): Promise<Order[]> {
    const missing = orders.filter((o) => !o.orderNumber);
    if (missing.length === 0) return orders;
    for (const order of missing) {
      order.orderNumber = await this.generateOrderNumber();
      try {
        await this.ordersRepo.update(
          { id: order.id },
          { orderNumber: order.orderNumber },
        );
      } catch {
        // If the update races another writer just leave the in-memory
        // value in place; the next read will resolve the persisted one.
      }
    }
    return orders;
  }

  async createForUser(userId: string, dto: CreateOrderDto) {
    const pin =
      dto.shippingAddress?.pinCode?.replace(/\s/g, '') ||
      dto.pinCode?.replace(/\s/g, '') ||
      '';
    const shipLat = dto.shippingAddress?.latitude;
    const shipLng = dto.shippingAddress?.longitude;

    // Fulfilment must always go to the *nearest* active branch — never the
    // alphabetical default. If the FE didn't capture lat/lng (browser
    // geolocation is opt-in and frequently denied), fall back to a server-
    // side PIN-code lookup so haversine still has coordinates to work with.
    let resolvedLat = typeof shipLat === 'number' ? shipLat : null;
    let resolvedLng = typeof shipLng === 'number' ? shipLng : null;
    if ((resolvedLat == null || resolvedLng == null) && pin) {
      const geo = await this.pincodeGeo.resolve(pin);
      if (geo) {
        resolvedLat = resolvedLat ?? geo.lat;
        resolvedLng = resolvedLng ?? geo.lng;
      }
    }

    const branch =
      pin || resolvedLat !== null || resolvedLng !== null
        ? await this.branchesService.assignBranchForOrder({
            pinCode: pin,
            latitude: resolvedLat,
            longitude: resolvedLng,
          })
        : null;

    const items =
      dto.items && dto.items.length > 0
        ? dto.items
        : [
            {
              productName: dto.description.slice(0, 120) || 'Custom order',
              quantity: 1,
              unitPrice: dto.subtotal ?? 0,
            },
          ];

    const computedSubtotal = items.reduce(
      (s, i) => s + i.quantity * i.unitPrice,
      0,
    );
    const subtotal = dto.subtotal ?? computedSubtotal;
    const gst = dto.gstAmount ?? Math.round(subtotal * 0.18 * 100) / 100;
    const designerFee = dto.designerFee ?? 0;
    const total =
      dto.totalAmount ?? Math.round((subtotal + gst + designerFee) * 100) / 100;

    const orderNumber = await this.generateOrderNumber();

    const order = this.ordersRepo.create({
      customerId: userId,
      orderNumber,
      branchId: branch?.id ?? null,
      designerId: dto.designerId ?? null,
      designerFee,
      productCategory: dto.productCategory?.trim() || 'general',
      description: dto.description,
      designNotes: dto.designNotes ?? null,
      status: 'order_placed',
      paymentStatus: 'pending',
      paymentMethod: dto.paymentMethod ?? 'cod',
      shippingAddress: dto.shippingAddress
        ? (dto.shippingAddress as unknown as Record<string, unknown>)
        : null,
      subtotal,
      gstAmount: gst,
      totalAmount: total,
      designFiles: [],
    });

    const saved = await this.ordersRepo.save(order);

    for (const row of items) {
      const line = this.itemsRepo.create({
        orderId: saved.id,
        productId: row.productId ?? null,
        productName: row.productName,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        size: row.size ?? null,
        color: row.color ?? null,
        productImage: row.productImage ?? null,
        customizedImage: row.customizedImage ?? null,
        designData: row.designData ?? null,
        measurements: row.measurements ?? null,
        customizationData: row.customizationData ?? null,
        variantSnapshot: row.variantSnapshot ?? null,
      });
      await this.itemsRepo.save(line);
    }

    await this.appendLog(saved.id, null, 'order_placed', userId, 'Order created');

    await this.notifications.notifyOrderPlaced(userId, saved.id);

    // Send order confirmation email (fire-and-forget — don't block order creation)
    void (async () => {
      try {
        const customer = (saved as any).customer as { email?: string; name?: string } | undefined;
        const emailTo = customer?.email ?? '';
        if (emailTo) {
          await this.mail.sendOrderConfirmation({
            to: emailTo,
            customerName: customer?.name ?? 'Customer',
            orderNumber: saved.orderNumber ?? saved.id.slice(0, 8).toUpperCase(),
            orderTotal: saved.totalAmount?.toFixed(2) ?? '0.00',
            items: items.map((i) => ({
              name: i.productName,
              qty: i.quantity,
              price: (i.unitPrice * i.quantity).toFixed(2),
            })),
            actionUrl: `${process.env.FRONTEND_URL ?? ''}/shop/my-orders`,
          });
        }
      } catch { /* mail failure must not break order creation */ }
    })();

    if (branch?.id) {
      await this.notifications.notifyBranchStaff(
        branch.id,
        saved.id,
        `New order ${saved.id.slice(0, 8)}… — ${saved.description.slice(0, 80)}`,
      );
    }

    return this.findOneForUser(saved.id, userId, null);
  }

  async findMine(userId: string) {
    const orders = await this.ordersRepo.find({
      where: { customerId: userId },
      relations: ['items', 'branch'],
      order: { createdAt: 'DESC' },
    });
    return this.backfillOrderNumbers(orders);
  }

  async findAllForStaff(actor: User) {
    const normalizedKind = normalizeKnownUserKind(actor.userKind);
    if (normalizedKind === UserKind.SUPER_ADMIN || normalizedKind === UserKind.OPS_HEAD) {
      const orders = await this.ordersRepo.find({
        relations: ['user', 'items', 'branch'],
        order: { createdAt: 'DESC' },
      });
      return this.backfillOrderNumbers(orders);
    }

    if (
      (isBranchAdminRole(normalizedKind) || normalizedKind === UserKind.STAFF) &&
      actor.branchId
    ) {
      const orders = await this.ordersRepo.find({
        where: { branchId: actor.branchId },
        relations: ['user', 'items', 'branch'],
        order: { createdAt: 'DESC' },
      });
      return this.backfillOrderNumbers(orders);
    }

    if (normalizedKind === UserKind.ADMIN || normalizedKind === UserKind.STAFF) {
      throw new ForbiddenException('Your account has no branch assignment.');
    }

    const orders = await this.ordersRepo.find({
      relations: ['user', 'items', 'branch'],
      order: { createdAt: 'DESC' },
    });
    return this.backfillOrderNumbers(orders);
  }

  async findOneForUser(
    id: string,
    customerId: string | null,
    actor: User | null,
  ) {
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: ['items', 'branch', 'statusLogs', 'user'],
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.orderNumber) {
      await this.backfillOrderNumbers([order]);
    }

    const isStaff =
      !!actor && isStaffOperationRole(actor.userKind as UserKind);

    if (customerId && order.customerId !== customerId && !isStaff) {
      throw new ForbiddenException();
    }

    const normalizedKind = normalizeKnownUserKind(actor?.userKind ?? null);
    if (
      (isBranchAdminRole(normalizedKind) || normalizedKind === UserKind.STAFF) &&
      !actor?.branchId
    ) {
      throw new ForbiddenException('Your account has no branch assignment.');
    }

    if (
      (isBranchAdminRole(normalizedKind) || normalizedKind === UserKind.STAFF) &&
      actor?.branchId &&
      order.branchId !== actor.branchId
    ) {
      throw new ForbiddenException();
    }

    const timeline = await this.logRepo.find({
      where: { orderId: id },
      order: { createdAt: 'ASC' },
    });

    return { ...order, timeline };
  }

  async updateStatus(
    id: string,
    dto: UpdateOrderStatusDto,
    actor: User | null,
  ) {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    const prev = order.status;
    order.status = dto.status;
    await this.ordersRepo.save(order);
    await this.appendLog(
      id,
      prev,
      dto.status,
      actor?.id ?? null,
      dto.note,
    );
    await this.notifications.notifyOrderStatus(
      order.customerId,
      order.id,
      dto.status,
      STATUS_LABELS[dto.status] ?? dto.status,
    );

    // Email on key status transitions
    if (['dispatched', 'delivered', 'cancelled'].includes(dto.status)) {
      void (async () => {
        try {
          const full = await this.ordersRepo.findOne({ where: { id }, relations: ['customer', 'items'] });
          const emailTo = (full as any)?.customer?.email ?? '';
          if (emailTo) {
            await this.mail.sendOrderStatusUpdate({
              to: emailTo,
              customerName: (full as any)?.customer?.name ?? 'Customer',
              orderNumber: full?.orderNumber ?? id.slice(0, 8).toUpperCase(),
              orderTotal: full?.totalAmount?.toFixed(2) ?? '0.00',
              items: ((full as any)?.items ?? []).map((i: any) => ({
                name: i.productName,
                qty: i.quantity,
                price: (i.unitPrice * i.quantity).toFixed(2),
              })),
              statusLabel: STATUS_LABELS[dto.status] ?? dto.status,
              trackingUrl: (full as any)?.trackingId ? `https://track.delhivery.com/?waybill=${(full as any).trackingId}` : undefined,
              actionUrl: `${process.env.FRONTEND_URL ?? ''}/shop/my-orders`,
            });
          }
        } catch { /* fire-and-forget */ }
      })();
    }

    return this.findOneForUser(id, null, actor);
  }

  async cancel(id: string, userId: string) {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== userId) throw new ForbiddenException();
    return this.updateStatus(
      id,
      { status: 'cancelled', note: 'Cancelled by customer' },
      { id: userId } as User,
    );
  }

  async requestReturn(id: string, userId: string, reason?: string) {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== userId) throw new ForbiddenException();
    return this.updateStatus(
      id,
      {
        status: 'return_requested',
        note: reason ?? 'Return requested by customer',
      },
      { id: userId } as User,
    );
  }

  async dispatch(id: string, dto: DispatchOrderDto, actor: User) {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    const prev = order.status;
    order.trackingId = dto.trackingId;
    order.logisticsPartner = dto.logisticsPartner ?? null;
    order.status = 'dispatched';
    await this.ordersRepo.save(order);
    await this.appendLog(
      id,
      prev,
      'dispatched',
      actor.id,
      `Tracking: ${dto.trackingId}`,
    );
    await this.notifications.notifyOrderStatus(
      order.customerId,
      order.id,
      'dispatched',
      'Dispatched',
    );
    return this.findOneForUser(id, null, actor);
  }

  async invoiceStub(id: string, userId: string | null, actor: User | null) {
    await this.findOneForUser(id, userId, actor);
    return {
      orderId: id,
      message:
        'Invoice PDF generation is not wired yet. Use order detail for line items and GST.',
      downloadUrl: null as string | null,
    };
  }

  /**
   * Customer-only: replace the shipping address snapshot on an order.
   * Blocked once the order has progressed past the early stages —
   * see `SHIPPING_ADDRESS_EDITABLE_STATUSES` for the canonical gate.
   *
   * When `syncToAddressBook` is true (default), we look for a saved
   * address that matches the *previous* shipping snapshot (before
   * the edit) and update that row. If no match is found we create a
   * new saved address so the change is reflected in the address book.
   */
  async updateShippingAddress(
    orderId: string,
    userId: string,
    dto: UpdateOrderShippingAddressDto,
  ) {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== userId) throw new ForbiddenException();

    if (!SHIPPING_ADDRESS_EDITABLE_STATUSES.has(order.status)) {
      throw new BadRequestException(
        `Shipping address can no longer be changed once the order is "${
          STATUS_LABELS[order.status] ?? order.status
        }".`,
      );
    }

    const previous =
      (order.shippingAddress as Record<string, unknown> | null) ?? null;

    const nextSnapshot: Record<string, unknown> = {
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      email: dto.email?.trim() || (previous?.email as string | undefined) || '',
      addressLine1: dto.addressLine1.trim(),
      addressLine2: dto.addressLine2?.trim() || '',
      city: dto.city.trim(),
      state: dto.state.trim(),
      country: dto.country.trim(),
      pinCode: dto.pinCode.trim(),
      ...(typeof dto.latitude === 'number' ? { latitude: dto.latitude } : {}),
      ...(typeof dto.longitude === 'number'
        ? { longitude: dto.longitude }
        : {}),
    };

    order.shippingAddress = nextSnapshot;

    // Re-resolve the fulfilment branch when the pin-code (or geo)
    // actually moves. Skipping when nothing routing-relevant changed
    // keeps the change cheap and avoids accidental branch swaps.
    const previousPin = String(
      (previous?.pinCode as string | undefined) ?? '',
    ).trim();
    const previousLat =
      typeof previous?.latitude === 'number'
        ? (previous.latitude as number)
        : null;
    const previousLng =
      typeof previous?.longitude === 'number'
        ? (previous.longitude as number)
        : null;
    const pinChanged = dto.pinCode.trim() !== previousPin;
    const latChanged =
      typeof dto.latitude === 'number' && dto.latitude !== previousLat;
    const lngChanged =
      typeof dto.longitude === 'number' && dto.longitude !== previousLng;

    if (pinChanged || latChanged || lngChanged) {
      let resolvedLat = typeof dto.latitude === 'number' ? dto.latitude : null;
      let resolvedLng = typeof dto.longitude === 'number' ? dto.longitude : null;
      if ((resolvedLat == null || resolvedLng == null) && dto.pinCode) {
        const geo = await this.pincodeGeo.resolve(dto.pinCode.trim());
        if (geo) {
          resolvedLat = resolvedLat ?? geo.lat;
          resolvedLng = resolvedLng ?? geo.lng;
        }
      }
      const branch = await this.branchesService.assignBranchForOrder({
        pinCode: dto.pinCode.trim(),
        latitude: resolvedLat,
        longitude: resolvedLng,
      });
      if (branch?.id) order.branchId = branch.id;
    }

    await this.ordersRepo.save(order);

    if (dto.syncToAddressBook ?? true) {
      await this.syncSavedAddress(userId, previous, dto);
    }

    await this.appendLog(
      order.id,
      order.status,
      order.status,
      userId,
      'Shipping address updated by customer',
    );

    return this.findOneForUser(order.id, userId, null);
  }

  /**
   * Best-effort sync of an order address edit into the user's saved
   * address book. We prefer to update the *matching saved row* (so
   * a tweaked apartment number doesn't clutter the list with a
   * second copy). If the previous order snapshot has no match —
   * e.g. the order was placed as a guest checkout without saving —
   * a new saved row is inserted instead.
   */
  private async syncSavedAddress(
    userId: string,
    previous: Record<string, unknown> | null,
    dto: UpdateOrderShippingAddressDto,
  ) {
    const saved = await this.addressesRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    let target: Address | null = null;
    if (previous) {
      const previousDraft: UpdateOrderShippingAddressDto = {
        fullName: String(previous.fullName ?? ''),
        phone: String(previous.phone ?? ''),
        addressLine1: String(previous.addressLine1 ?? ''),
        addressLine2:
          typeof previous.addressLine2 === 'string'
            ? previous.addressLine2
            : undefined,
        city: String(previous.city ?? ''),
        state: String(previous.state ?? ''),
        country: String(previous.country ?? ''),
        pinCode: String(previous.pinCode ?? ''),
      };
      target = saved.find((row) => addressMatches(row, previousDraft)) ?? null;
    }
    if (!target) {
      target = saved.find((row) => addressMatches(row, dto)) ?? null;
    }

    if (target) {
      target.fullName = dto.fullName.trim();
      target.phone = dto.phone.trim();
      target.addressLine1 = dto.addressLine1.trim();
      target.addressLine2 = dto.addressLine2?.trim() || null;
      target.city = dto.city.trim();
      target.state = dto.state.trim();
      target.country = dto.country.trim();
      target.pinCode = dto.pinCode.trim();
      await this.addressesRepo.save(target);
      return;
    }

    const fresh = this.addressesRepo.create({
      userId,
      isDefault: saved.length === 0,
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      addressLine1: dto.addressLine1.trim(),
      addressLine2: dto.addressLine2?.trim() || null,
      city: dto.city.trim(),
      state: dto.state.trim(),
      country: dto.country.trim(),
      pinCode: dto.pinCode.trim(),
    });
    await this.addressesRepo.save(fresh);
  }
}
