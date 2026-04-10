import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

export type PrintOrderStatus =
  | 'pending'
  | 'in_review'
  | 'in_production'
  | 'shipped'
  | 'completed'
  | 'cancelled';

@Entity('print_orders')
export class PrintOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (u) => u.orders, { onDelete: 'CASCADE' })
  user: User;

  /** e.g. t-shirt, water-bottle, hoodie */
  @Column()
  productCategory: string;

  @Column('text')
  description: string;

  @Column('text', { nullable: true })
  designNotes: string | null;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: PrintOrderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
