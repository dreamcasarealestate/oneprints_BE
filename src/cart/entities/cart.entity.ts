import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/user.entity';
import { CartItem } from './cart-item.entity';

/**
 * Persistent shopping cart per user. We keep a single row per
 * customer so the cart survives across devices and browser sessions
 * — sign in on a new phone and your saved items follow you. Money
 * fields are stored as `numeric` strings to keep things rounding-safe
 * (the FE formats them with `Intl.NumberFormat`).
 */
@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 8, default: 'INR' })
  currency: string;

  /** Optional coupon code applied by the user. Validation is the BE's job at order time. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  couponCode: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  subTotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  discountTotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  couponDiscount: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  taxTotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  shippingTotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  feeTotal: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  grandTotal: string;

  /** Free-form metadata buckets the FE may write through (e.g. last-seen address). */
  @Column('jsonb', { nullable: true })
  shippingDetails: Record<string, unknown> | null;

  @Column('jsonb', { nullable: true })
  billingDetails: Record<string, unknown> | null;

  @Column('jsonb', { nullable: true })
  meta: Record<string, unknown> | null;

  @OneToMany(() => CartItem, (i) => i.cart, { cascade: true })
  items: CartItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
