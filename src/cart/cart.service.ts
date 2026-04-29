import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { User } from '../user/user.entity';
import { Product } from '../catalogue/product.entity';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { SyncCartDto } from './dto/sync-cart.dto';
import { UpdateCartMetaDto } from './dto/update-cart-meta.dto';

/**
 * Backend cart service. Carts are persisted per user and survive
 * across browser sessions and devices — sign in on a phone after
 * adding items on a laptop and the cart follows you. The service
 * recomputes line and cart totals on every mutation so the
 * storefront can simply re-render the response without re-running
 * pricing logic.
 */
@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepo: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly itemsRepo: Repository<CartItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
  ) {}

  // ---------- helpers ----------

  private toNum(v: unknown): number {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  private money(n: number): string {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  private computeItemTotals(input: {
    unitPrice: unknown;
    quantity: unknown;
    unitDiscount?: unknown;
    taxPercent?: unknown;
  }) {
    const unitPrice = this.toNum(input.unitPrice);
    const qty = Math.max(this.toNum(input.quantity), 1);
    const unitDiscount = this.toNum(input.unitDiscount);
    const taxPercent = this.toNum(input.taxPercent);

    const itemSubTotal = unitPrice * qty;
    const discountAmount = unitDiscount * qty;
    const taxAmount = (itemSubTotal * taxPercent) / 100;
    const itemTotal = itemSubTotal + taxAmount - discountAmount;

    return {
      itemSubTotal: this.money(itemSubTotal),
      taxPercent: this.money(taxPercent),
      taxAmount: this.money(taxAmount),
      discountAmount: this.money(discountAmount),
      itemTotal: this.money(Math.max(itemTotal, 0)),
    };
  }

  private recomputeCartTotals(cart: Cart) {
    const items = cart.items ?? [];
    const subTotal = items.reduce(
      (s, i) => s + this.toNum(i.itemSubTotal),
      0,
    );
    const discountTotal = items.reduce(
      (s, i) => s + this.toNum(i.discountAmount),
      0,
    );
    const taxTotal = items.reduce((s, i) => s + this.toNum(i.taxAmount), 0);
    const couponDiscount = this.toNum(cart.couponDiscount);
    const shippingTotal = this.toNum(cart.shippingTotal);
    const feeTotal = this.toNum(cart.feeTotal);

    const grandTotal =
      subTotal +
      taxTotal +
      shippingTotal +
      feeTotal -
      discountTotal -
      couponDiscount;

    cart.subTotal = this.money(subTotal);
    cart.discountTotal = this.money(discountTotal);
    cart.taxTotal = this.money(taxTotal);
    cart.grandTotal = this.money(Math.max(grandTotal, 0));
  }

  /**
   * Confirms the catalogue product still exists and is purchasable
   * before letting the line into the cart. Skipped silently when the
   * line is not tied to a catalogue product (allows future verticals
   * to share the same cart shape without owning a Product row).
   */
  private async assertProductPurchasable(
    productId: string | null | undefined,
  ): Promise<Product | null> {
    if (!productId) return null;
    const product = await this.productsRepo.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.isActive === false) {
      throw new BadRequestException(
        'This product is not available for purchase',
      );
    }
    return product;
  }

  private async loadCartOrCreate(userId: string): Promise<Cart> {
    let cart = await this.cartRepo.findOne({
      where: { userId },
      relations: ['items'],
      order: { items: { createdAt: 'ASC' } },
    });
    if (cart) return cart;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    cart = this.cartRepo.create({
      userId,
      user,
      currency: 'INR',
      subTotal: '0.00',
      discountTotal: '0.00',
      couponDiscount: '0.00',
      taxTotal: '0.00',
      shippingTotal: '0.00',
      feeTotal: '0.00',
      grandTotal: '0.00',
      items: [],
    });
    cart = await this.cartRepo.save(cart);
    return cart;
  }

  /**
   * Reload the cart from the DB after a mutation and persist updated
   * totals. Returns the canonical, fully-relational view so the
   * controller can hand it straight back to the FE.
   */
  private async refreshAndSave(cartId: string): Promise<Cart> {
    const cart = await this.cartRepo.findOne({
      where: { id: cartId },
      relations: ['items'],
      order: { items: { createdAt: 'ASC' } },
    });
    if (!cart) throw new NotFoundException('Cart disappeared mid-update');
    this.recomputeCartTotals(cart);
    await this.cartRepo.save(cart);
    return cart;
  }

  // ---------- public API ----------

  /** Idempotent: returns the user's cart, creating an empty one if missing. */
  async getOrCreateCart(userId: string): Promise<Cart> {
    const cart = await this.loadCartOrCreate(userId);
    return this.refreshAndSave(cart.id);
  }

  async addItem(userId: string, dto: AddToCartDto): Promise<Cart> {
    const cart = await this.loadCartOrCreate(userId);
    const product = await this.assertProductPurchasable(dto.productId);

    const qty = dto.quantity ?? 1;
    if (qty < 1) {
      throw new BadRequestException('Quantity must be >= 1');
    }

    // Match an existing line by product + variant + customisation
    // signature so re-adding the same configuration just bumps the
    // quantity instead of stacking duplicate rows. Anything customer-
    // visible (size / colour / designId / custom fields / sides) is
    // part of the signature so personalised lines stay separate.
    const signature = this.lineSignature(dto);
    const existing = (cart.items ?? []).find(
      (line) => this.lineSignature(line) === signature,
    );

    if (existing) {
      existing.quantity += qty;
      this.applySnapshotToItem(existing, dto, product);
      Object.assign(
        existing,
        this.computeItemTotals({
          unitPrice: existing.unitPrice,
          quantity: existing.quantity,
          unitDiscount: existing.unitDiscount,
          taxPercent: existing.taxPercent,
        }),
      );
      await this.itemsRepo.save(existing);
    } else {
      const item = this.itemsRepo.create({
        cartId: cart.id,
        cart,
        productId: product?.id ?? null,
        product: product ?? null,
        variantId: dto.variantId ?? null,
        productName: dto.productName,
        quantity: qty,
        unitPrice: this.money(this.toNum(dto.unitPrice)),
        mrp: dto.mrp != null ? this.money(this.toNum(dto.mrp)) : null,
        unitDiscount: this.money(this.toNum(dto.unitDiscount)),
        taxPercent: this.money(this.toNum(dto.taxPercent)),
        size: dto.size ?? null,
        color: dto.color ?? null,
        designId: dto.designId ?? null,
        productImage: dto.productImage ?? null,
        blankImage: dto.blankImage ?? null,
        designThumbnail: dto.designThumbnail ?? null,
        sideThumbnails: dto.sideThumbnails ?? null,
        printSides:
          dto.printSides && dto.printSides.length > 0
            ? dto.printSides
            : null,
        customFieldValues:
          dto.customFieldValues &&
          Object.keys(dto.customFieldValues).length > 0
            ? dto.customFieldValues
            : null,
        snapshot: dto.snapshot ?? null,
        meta: dto.meta ?? null,
        ...this.computeItemTotals({
          unitPrice: dto.unitPrice,
          quantity: qty,
          unitDiscount: dto.unitDiscount,
          taxPercent: dto.taxPercent,
        }),
      });
      await this.itemsRepo.save(item);
    }

    return this.refreshAndSave(cart.id);
  }

  async updateItem(
    userId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<Cart> {
    const cart = await this.loadCartOrCreate(userId);
    const item = (cart.items ?? []).find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    if (dto.quantity !== undefined) {
      if (dto.quantity < 1) {
        throw new BadRequestException('Quantity must be >= 1');
      }
      item.quantity = dto.quantity;
    }
    if (dto.productName !== undefined) item.productName = dto.productName;
    if (dto.unitPrice !== undefined) {
      item.unitPrice = this.money(this.toNum(dto.unitPrice));
    }
    if (dto.mrp !== undefined) {
      item.mrp = this.money(this.toNum(dto.mrp));
    }
    if (dto.unitDiscount !== undefined) {
      item.unitDiscount = this.money(this.toNum(dto.unitDiscount));
    }
    if (dto.taxPercent !== undefined) {
      item.taxPercent = this.money(this.toNum(dto.taxPercent));
    }
    if (dto.size !== undefined) item.size = dto.size || null;
    if (dto.color !== undefined) item.color = dto.color || null;
    if (dto.designId !== undefined) item.designId = dto.designId || null;
    if (dto.productImage !== undefined) {
      item.productImage = dto.productImage || null;
    }
    if (dto.blankImage !== undefined) item.blankImage = dto.blankImage || null;
    if (dto.designThumbnail !== undefined) {
      item.designThumbnail = dto.designThumbnail || null;
    }
    if (dto.sideThumbnails !== undefined) {
      item.sideThumbnails = dto.sideThumbnails ?? null;
    }
    if (dto.printSides !== undefined) {
      item.printSides =
        dto.printSides && dto.printSides.length > 0 ? dto.printSides : null;
    }
    if (dto.customFieldValues !== undefined) {
      item.customFieldValues =
        dto.customFieldValues &&
        Object.keys(dto.customFieldValues).length > 0
          ? dto.customFieldValues
          : null;
    }
    if (dto.snapshot !== undefined) item.snapshot = dto.snapshot ?? null;
    if (dto.meta !== undefined) {
      item.meta = { ...(item.meta ?? {}), ...(dto.meta ?? {}) };
    }

    Object.assign(
      item,
      this.computeItemTotals({
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        unitDiscount: item.unitDiscount,
        taxPercent: item.taxPercent,
      }),
    );
    await this.itemsRepo.save(item);

    return this.refreshAndSave(cart.id);
  }

  async removeItem(userId: string, itemId: string): Promise<Cart> {
    const cart = await this.loadCartOrCreate(userId);
    const item = (cart.items ?? []).find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    await this.itemsRepo.delete(itemId);
    return this.refreshAndSave(cart.id);
  }

  async clear(userId: string): Promise<Cart> {
    const cart = await this.loadCartOrCreate(userId);
    if ((cart.items ?? []).length > 0) {
      await this.itemsRepo.delete({ cartId: cart.id });
    }
    cart.items = [];
    cart.couponCode = null;
    cart.couponDiscount = '0.00';
    this.recomputeCartTotals(cart);
    await this.cartRepo.save(cart);
    return this.refreshAndSave(cart.id);
  }

  /**
   * Replace cart contents with the provided snapshot. Used when a
   * guest signs in and we need to merge their localStorage cart with
   * the server-side cart in one atomic call.
   */
  async sync(userId: string, dto: SyncCartDto): Promise<Cart> {
    const cart = await this.loadCartOrCreate(userId);

    for (const item of dto.items ?? []) {
      await this.assertProductPurchasable(item.productId);
    }

    if ((cart.items ?? []).length > 0) {
      await this.itemsRepo.delete({ cartId: cart.id });
    }

    const newItems = (dto.items ?? []).map((i) => {
      const qty = i.quantity ?? 1;
      const totals = this.computeItemTotals({
        unitPrice: i.unitPrice,
        quantity: qty,
        unitDiscount: i.unitDiscount,
        taxPercent: i.taxPercent,
      });
      return this.itemsRepo.create({
        cartId: cart.id,
        cart,
        productId: i.productId ?? null,
        variantId: i.variantId ?? null,
        productName: i.productName,
        quantity: qty,
        unitPrice: this.money(this.toNum(i.unitPrice)),
        mrp: i.mrp != null ? this.money(this.toNum(i.mrp)) : null,
        unitDiscount: this.money(this.toNum(i.unitDiscount)),
        taxPercent: this.money(this.toNum(i.taxPercent)),
        size: i.size ?? null,
        color: i.color ?? null,
        designId: i.designId ?? null,
        productImage: i.productImage ?? null,
        blankImage: i.blankImage ?? null,
        designThumbnail: i.designThumbnail ?? null,
        sideThumbnails: i.sideThumbnails ?? null,
        printSides:
          i.printSides && i.printSides.length > 0 ? i.printSides : null,
        customFieldValues:
          i.customFieldValues && Object.keys(i.customFieldValues).length > 0
            ? i.customFieldValues
            : null,
        snapshot: i.snapshot ?? null,
        meta: i.meta ?? null,
        ...totals,
      });
    });

    if (newItems.length > 0) {
      await this.itemsRepo.save(newItems);
    }

    if (dto.couponCode !== undefined) {
      cart.couponCode = dto.couponCode || null;
      await this.cartRepo.save(cart);
    }

    return this.refreshAndSave(cart.id);
  }

  async updateMeta(userId: string, dto: UpdateCartMetaDto): Promise<Cart> {
    const cart = await this.loadCartOrCreate(userId);

    if (dto.currency !== undefined) cart.currency = dto.currency;
    if (dto.couponCode !== undefined) cart.couponCode = dto.couponCode || null;
    if (dto.shippingDetails !== undefined) {
      cart.shippingDetails = dto.shippingDetails ?? null;
    }
    if (dto.billingDetails !== undefined) {
      cart.billingDetails = dto.billingDetails ?? null;
    }
    if (dto.meta !== undefined) {
      cart.meta = { ...(cart.meta ?? {}), ...(dto.meta ?? {}) };
    }

    await this.cartRepo.save(cart);
    return this.refreshAndSave(cart.id);
  }

  // ---------- internals ----------

  /**
   * Identity for "is this the same cart line?" — covers product +
   * variant + size + colour + design + custom field values + side
   * thumbnails so re-adding an identical configuration bumps the
   * quantity, while different personalisations stay as separate rows.
   */
  private lineSignature(input: {
    productId?: string | null;
    variantId?: string | null;
    size?: string | null;
    color?: string | null;
    designId?: string | null;
    customFieldValues?: Record<string, string> | null;
    sideThumbnails?: Record<string, string | null> | null;
    printSides?: string[] | null;
  }): string {
    const cfv = input.customFieldValues
      ? Object.entries(input.customFieldValues)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('|')
      : '';
    const sides = input.printSides ? [...input.printSides].sort().join(',') : '';
    return [
      input.productId ?? '-',
      input.variantId ?? '-',
      input.size ?? '-',
      input.color ?? '-',
      input.designId ?? '-',
      cfv,
      sides,
    ].join('::');
  }

  private applySnapshotToItem(
    item: CartItem,
    dto: AddToCartDto,
    product: Product | null,
  ) {
    if (dto.productName) item.productName = dto.productName;
    if (dto.unitPrice !== undefined) {
      item.unitPrice = this.money(this.toNum(dto.unitPrice));
    }
    if (dto.mrp !== undefined) {
      item.mrp = this.money(this.toNum(dto.mrp));
    }
    if (dto.unitDiscount !== undefined) {
      item.unitDiscount = this.money(this.toNum(dto.unitDiscount));
    }
    if (dto.taxPercent !== undefined) {
      item.taxPercent = this.money(this.toNum(dto.taxPercent));
    }
    if (dto.productImage !== undefined) {
      item.productImage = dto.productImage || null;
    }
    if (dto.blankImage !== undefined) item.blankImage = dto.blankImage || null;
    if (dto.designThumbnail !== undefined) {
      item.designThumbnail = dto.designThumbnail || null;
    }
    if (dto.sideThumbnails !== undefined) {
      item.sideThumbnails = dto.sideThumbnails ?? null;
    }
    if (dto.printSides !== undefined) {
      item.printSides =
        dto.printSides && dto.printSides.length > 0 ? dto.printSides : null;
    }
    if (dto.snapshot !== undefined) item.snapshot = dto.snapshot ?? null;
    if (dto.meta !== undefined) {
      item.meta = { ...(item.meta ?? {}), ...(dto.meta ?? {}) };
    }
    if (product && !item.productId) item.productId = product.id;
  }
}
