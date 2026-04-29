import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Cart } from './cart.entity';
import { Product } from '../../catalogue/product.entity';

/**
 * A single line in the customer's cart. Mirrors the rich order-item
 * shape so the storefront can lift the same record straight into a
 * new order at checkout: we keep size, colour, the user's design
 * thumbnail, per-side thumbnails, and any custom field values the
 * shopper filled in on the PDP.
 *
 * `productId` is a soft FK because product rows can be archived
 * without invalidating an existing cart — the snapshot fields
 * (`name`, `unitPrice`, `productImage`, `customizedImage`, …) keep
 * the cart line readable even if the catalogue row goes away.
 */
@Entity('cart_items')
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  cartId: string;

  @ManyToOne(() => Cart, (c) => c.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cartId' })
  cart: Cart;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  /** Optional variant key (slug of colour/size) — kept for future variant-level pricing. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  variantId: string | null;

  @Column({ type: 'varchar', length: 255 })
  productName: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  unitPrice: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  mrp: string | null;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  unitDiscount: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  taxPercent: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  itemSubTotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  taxAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  discountAmount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  itemTotal: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  size: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  color: string | null;

  /** Reference to the saved Design row so "Edit" in the cart can re-open the canvas. */
  @Column({ type: 'uuid', nullable: true })
  designId: string | null;

  /** Storefront product image URL for the selected colour. */
  @Column('text', { nullable: true })
  productImage: string | null;

  /** Blank/template product image (no design overlay). */
  @Column('text', { nullable: true })
  blankImage: string | null;

  /** Composite design thumbnail (data-URL or hosted PNG) for the active side. */
  @Column('text', { nullable: true })
  designThumbnail: string | null;

  /** Per-side composite design thumbnails for multi-side products. */
  @Column('jsonb', { nullable: true })
  sideThumbnails: Record<string, string | null> | null;

  /** Print sides this product supports, e.g. ["front","back"]. */
  @Column('jsonb', { nullable: true })
  printSides: string[] | null;

  /** Customer-entered values for product custom fields. */
  @Column('jsonb', { nullable: true })
  customFieldValues: Record<string, string> | null;

  /**
   * Free-form snapshot bag (image / brand / sku / source / attributes).
   * Mirrors the reference cart implementation and keeps room for
   * downstream verticals (electronics / furniture / decor) without
   * requiring schema changes.
   */
  @Column('jsonb', { nullable: true })
  snapshot: Record<string, unknown> | null;

  /** Free-form metadata bucket (analytics tags, source page, etc.). */
  @Column('jsonb', { nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
