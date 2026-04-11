import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../user/user.entity';
import { Order } from '../order/order.entity';
import { Designer } from '../designer/designer.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid' })
  reviewerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewerId' })
  reviewer: User;

  @Column({ type: 'uuid', nullable: true })
  designerId: string | null;

  @ManyToOne(() => Designer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'designerId' })
  designer: Designer | null;

  @Column({ type: 'int' })
  stars: number;

  @Column('text', { nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
