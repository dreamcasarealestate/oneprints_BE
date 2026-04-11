import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Designer } from '../designer/designer.entity';
import { Order } from '../order/order.entity';

@Entity('payouts')
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  designerId: string;

  @ManyToOne(() => Designer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'designerId' })
  designer: Designer;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('double precision')
  amount: number;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: 'pending' | 'processing' | 'paid' | 'failed';

  @Column({ nullable: true })
  payoutMethod: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
