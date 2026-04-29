import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

export type ProductionStatus =
  | 'queued'
  | 'prepress'
  | 'printing'
  | 'finishing'
  | 'qc'
  | 'done'
  | 'on_hold'
  | 'cancelled';

@Entity('production_jobs')
export class ProductionJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @Column({ type: 'uuid', nullable: true })
  orderItemId: string | null;

  /** Human-readable job number for shop floor (e.g. JOB-0042) */
  @Column({ unique: true })
  jobNumber: string;

  @Column({ type: 'varchar', default: 'queued' })
  status: ProductionStatus;

  @Column({ type: 'uuid', nullable: true })
  assignedOperatorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedOperatorId' })
  assignedOperator: User | null;

  /** Branch this job belongs to */
  @Column({ type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ nullable: true })
  productName: string | null;

  @Column({ default: 1 })
  quantity: number;

  @Column({ nullable: true })
  notes: string | null;

  /** URL of the print-ready PDF/PNG exported for production */
  @Column({ nullable: true })
  printFileUrl: string | null;

  @Column({ nullable: true })
  startedAt: Date | null;

  @Column({ nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
