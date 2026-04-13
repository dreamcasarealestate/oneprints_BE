import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  type: string;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 16, default: 'normal' })
  priority: 'low' | 'normal' | 'high';

  @Column({ type: 'varchar', length: 32, default: 'in_app' })
  channel: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  actionUrl: string | null;

  /** When set, duplicate deliveries with the same key are skipped for 24h */
  @Column({ type: 'varchar', length: 256, nullable: true })
  dedupeKey: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  /** Hide from lists / SSE until this time (snooze / remind later) */
  @Column({ type: 'timestamptz', nullable: true })
  snoozedUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
