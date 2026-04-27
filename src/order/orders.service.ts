import {
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
import { BranchesService } from '../branch/branch.service';
import { PincodeGeoService } from '../branch/pincode-geo.service';
import { NotificationsService } from '../notification/notifications.service';
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

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly itemsRepo: Repository<OrderItem>,
    @InjectRepository(OrderStatusLog)
    private readonly logRepo: Repository<OrderStatusLog>,
    private readonly branchesService: BranchesService,
    private readonly pincodeGeo: PincodeGeoService,
    private readonly notifications: NotificationsService,
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
}
