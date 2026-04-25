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
import { Branch } from '../branch/branch.entity';

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

  /** Public URL to the user's profile image on S3. Optional — not set on register. */
  @Column({ type: 'varchar', length: 1024, nullable: true })
  profileImage: string | null;

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

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch | null;

  @Column({ select: false })
  passwordHash: string;

  /**
   * Soft-disable flag. When false, user cannot log in but data is preserved
   * (used for self-service account deactivation / admin suspension).
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** When the account was deactivated (soft-disabled). */
  @Column({ type: 'timestamptz', nullable: true })
  deactivatedAt: Date | null;

  /**
   * When the account was scheduled for permanent deletion. Rows kept around
   * for the grace window so legally-required records (orders, invoices) stay
   * intact. Hard delete happens by a scheduled job after the grace period.
   */
  @Column({ type: 'timestamptz', nullable: true })
  deletionScheduledAt: Date | null;

  /** When the user actually got purged from the system. */
  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  /** Optional reason captured for analytics & support follow-ups. */
  @Column({ type: 'varchar', length: 512, nullable: true })
  deletionReason: string | null;

  @OneToMany(() => Order, (o) => o.user)
  orders: Order[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
