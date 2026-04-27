import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { Branch } from '../branch/branch.entity';
import { Designer } from '../designer/designer.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatusLog } from './order-status-log.entity';

/** OMS lifecycle — includes legacy values for existing rows */
export type OrderStatus =
  | 'pending'
  | 'order_placed'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'design_pending'
  | 'in_review'
  | 'in_production'
  | 'qc_check'
  | 'ready_for_dispatch'
  | 'dispatched'
  | 'out_for_delivery'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'return_requested'
  | 'refunded';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Human-readable order code shown to shoppers and operators
   * (e.g. `OPR-260427-A1B2C3`). Generated at creation time. Older
   * rows can be `null` until the lazy backfill in OrdersService runs.
   */
  @Column({ type: 'varchar', length: 32, nullable: true, unique: true })
  orderNumber: string | null;

  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => User, (u) => u.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  branchId: string | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch | null;

  @Column({ type: 'uuid', nullable: true })
  designerId: string | null;

  @ManyToOne(() => Designer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'designerId' })
  designer: Designer | null;

  @Column('double precision', { default: 0 })
  designerFee: number;

  /** High-level category slug for filters / legacy */
  @Column({ default: 'general' })
  productCategory: string;

  @Column('text')
  description: string;

  @Column('text', { nullable: true })
  designNotes: string | null;

  @Column({ type: 'varchar', length: 40, default: 'order_placed' })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'partial';

  @Column({ type: 'varchar', length: 24, nullable: true })
  paymentMethod: string | null;

  @Column({ nullable: true })
  razorpayOrderId: string | null;

  @Column('jsonb', { nullable: true })
  shippingAddress: Record<string, unknown> | null;

  @Column({ nullable: true })
  trackingId: string | null;

  @Column({ nullable: true })
  logisticsPartner: string | null;

  @Column({ nullable: true })
  invoiceUrl: string | null;

  @Column({ nullable: true })
  corporatePoUrl: string | null;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('jsonb', { default: [] })
  designFiles: string[];

  @Column('double precision', { nullable: true })
  subtotal: number | null;

  @Column('double precision', { nullable: true })
  gstAmount: number | null;

  @Column('double precision', { nullable: true })
  totalAmount: number | null;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => OrderStatusLog, (l) => l.order, { cascade: true })
  statusLogs: OrderStatusLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
