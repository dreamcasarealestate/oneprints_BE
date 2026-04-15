import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity('favorites')
@Unique(['userId', 'resourceKey'])
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 80, default: 'generic' })
  resourceType: string;

  @Column({ type: 'varchar', length: 255 })
  resourceKey: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column('jsonb', { default: {} })
  payload: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
