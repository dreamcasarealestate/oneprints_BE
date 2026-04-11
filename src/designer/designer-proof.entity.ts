import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DesignerJob } from './designer-job.entity';

@Entity('designer_proofs')
export class DesignerProof {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  jobId: string;

  @ManyToOne(() => DesignerJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: DesignerJob;

  @Column()
  fileUrl: string;

  @Column({ type: 'int', default: 1 })
  revisionRound: number;

  @CreateDateColumn()
  createdAt: Date;
}
