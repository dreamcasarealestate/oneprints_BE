import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Coupon } from './coupon.entity';
import { User } from '../user/user.entity';

@Entity('coupon_redemptions')
export class CouponRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  couponId: string;

  @ManyToOne(() => Coupon, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @Column('decimal', { precision: 10, scale: 2 })
  discountAmount: number;

  @CreateDateColumn()
  createdAt: Date;
}
