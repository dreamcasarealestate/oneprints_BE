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

export type DesignerMessageAttachmentKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'file';

export type DesignerMessageAttachment = {
  url: string;
  name: string;
  mime: string;
  size?: number;
  /** For audio/video, recorded length in seconds (best-effort, client-supplied). */
  durationSec?: number;
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

  /** When set, this message is a quoted reply to another message in the same thread. */
  @Column({ type: 'uuid', nullable: true })
  replyToMessageId: string | null;

  /** Read receipt — set when the other participant has opened/viewed this message. */
  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  /** Soft-delete marker. When set, the message body/attachments are hidden and a
   * "This message was deleted" placeholder is shown to both participants. */
  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
