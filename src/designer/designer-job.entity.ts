import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DesignerJobStatus =
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

@Entity('designer_jobs')
export class DesignerJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  customerUserId: string;

  @Column({ type: 'uuid' })
  designerId: string;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ type: 'uuid', nullable: true })
  orderItemId: string | null;

  @Column({ default: 'Design request' })
  title: string;

  @Column('text')
  brief: string;

  @Column('double precision', { nullable: true })
  budgetInr: number | null;

  @Column({ nullable: true })
  deadlineText: string | null;

  @Column('jsonb', { default: [] })
  referenceAssetUrls: string[];

  @Column('text', { nullable: true })
  designDraftJson: string | null;

  @Column({ type: 'varchar', length: 24, default: 'requested' })
  status: DesignerJobStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
