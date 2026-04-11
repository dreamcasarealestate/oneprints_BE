import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { User } from '../user/user.entity';

@Entity('order_status_log')
export class OrderStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, (o) => o.statusLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ nullable: true })
  fromStatus: string | null;

  @Column()
  toStatus: string;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorId' })
  actor: User | null;

  @Column('text', { nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
