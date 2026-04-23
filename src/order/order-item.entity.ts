import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../catalogue/product.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  @Column()
  productName: string;

  @Column({ default: 1 })
  quantity: number;

  @Column('double precision')
  unitPrice: number;

  @Column({ nullable: true })
  size: string | null;

  @Column({ nullable: true })
  color: string | null;

  /** Original product display image URL for the selected colour. */
  @Column('text', { nullable: true })
  productImage: string | null;

  /** User's customized design thumbnail URL (canvas export). */
  @Column('text', { nullable: true })
  customizedImage: string | null;

  @Column('jsonb', { nullable: true })
  designData: Record<string, unknown> | null;

  @Column('jsonb', { nullable: true })
  measurements: Record<string, unknown> | null;

  @Column('jsonb', { nullable: true })
  customizationData: Record<string, unknown> | null;

  /**
   * Frozen snapshot of the product variant the shopper saw at order time
   * (per-colour MRP / selling price / discount / stock). Kept so fulfilment
   * and invoices can reflect the exact pricing the customer agreed to, even
   * if the admin later changes the product's variants.
   */
  @Column('jsonb', { nullable: true })
  variantSnapshot: {
    key?: string;
    colorName?: string;
    colorHex?: string | null;
    mrp?: number | null;
    sellingPrice?: number | null;
    discountPercent?: number | null;
    stockQty?: number | null;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
