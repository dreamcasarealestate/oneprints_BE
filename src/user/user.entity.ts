import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserKind } from './user-kind.enum';
import { Order } from '../order/order.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  phoneNumber: string;

  @Column({ type: 'varchar', length: 32, default: UserKind.USER })
  userKind: UserKind;

  /** Set for branch_manager; null for global operational roles */
  @Column({ type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ select: false })
  passwordHash: string;

  @OneToMany(() => Order, (o) => o.user)
  orders: Order[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
