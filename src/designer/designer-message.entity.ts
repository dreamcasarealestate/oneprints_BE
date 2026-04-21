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

export type DesignerMessageAttachmentKind = 'image' | 'video' | 'file';

export type DesignerMessageAttachment = {
  url: string;
  name: string;
  mime: string;
  size?: number;
  kind: DesignerMessageAttachmentKind;
  /** When true, this attachment is the designer's final deliverable (for add-to-cart). */
  isFinal?: boolean;
};

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

  @Column('text', { default: '' })
  body: string;

  @Column('jsonb', { default: [] })
  attachments: DesignerMessageAttachment[];

  @CreateDateColumn()
  createdAt: Date;
}
