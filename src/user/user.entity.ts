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
import { UserKind } from './user-kind.enum';
import { Order } from '../order/order.entity';
import { Role } from './role.entity';

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

  @Column({ type: 'uuid', nullable: true })
  roleId: string | null;

  @ManyToOne(() => Role, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roleId' })
  role: Role | null;

  /** Per-user notification prefs: muted types, digest, push, etc. */
  @Column('jsonb', { nullable: true })
  notificationPreferences: Record<string, unknown> | null;

  /** Set for branch-scoped roles; null for global operational roles */
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
