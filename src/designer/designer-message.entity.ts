import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DesignerJob } from './designer-job.entity';
import { User } from '../user/user.entity';

@Entity('designer_messages')
export class DesignerMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  jobId: string;

  @ManyToOne(() => DesignerJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: DesignerJob;

  @Column({ type: 'uuid' })
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column('text')
  body: string;

  @CreateDateColumn()
  createdAt: Date;
}
