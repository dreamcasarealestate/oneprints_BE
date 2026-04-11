import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../order/order.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('double precision')
  amount: number;

  @Column({ type: 'varchar', length: 24 })
  status: 'pending' | 'captured' | 'failed' | 'refunded';

  @Column({ nullable: true })
  method: string | null;

  @Column({ nullable: true })
  razorpayPaymentId: string | null;

  @Column({ nullable: true })
  razorpayOrderId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
