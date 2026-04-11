import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DesignerProfileStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended';

@Entity('designers')
export class Designer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column()
  displayName: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  city: string | null;

  @Column('text', { nullable: true })
  bio: string | null;

  @Column('jsonb', { default: [] })
  specializations: string[];

  @Column('jsonb', { default: [] })
  portfolioUrls: string[];

  @Column('double precision', { default: 0 })
  baseRateInr: number;

  @Column({ default: 'project' })
  rateType: 'hourly' | 'project';

  @Column({ type: 'int', default: 0 })
  yearsExperience: number;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: DesignerProfileStatus;

  @Column({ default: false })
  verified: boolean;

  @Column({ type: 'varchar', length: 32, default: 'available' })
  availability: 'available' | 'busy' | 'on_leave';

  @Column({ nullable: true })
  turnaroundText: string | null;

  @Column('text', { nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
