import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CouponType = 'fixed' | 'percent' | 'free_shipping';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ nullable: true })
  description: string | null;

  @Column({ type: 'varchar', default: 'percent' })
  type: CouponType;

  /** Discount value: amount in paise for fixed, percentage points for percent */
  @Column('decimal', { precision: 10, scale: 2 })
  value: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  minOrderAmount: number;

  /** Maximum discount cap for percent coupons (null = no cap) */
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  maxDiscount: number | null;

  /** 0 = unlimited */
  @Column({ default: 0 })
  maxUses: number;

  @Column({ default: 0 })
  usedCount: number;

  /** 1 = once per user, 0 = unlimited per user */
  @Column({ default: 0 })
  maxUsesPerUser: number;

  @Column({ nullable: true })
  expiresAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  /** Restrict to specific product IDs (empty = all products) */
  @Column('uuid', { array: true, default: [] })
  productIds: string[];

  /** Restrict to specific category slugs (empty = all categories) */
  @Column('text', { array: true, default: [] })
  categorySlugs: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
