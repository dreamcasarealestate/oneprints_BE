import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('design_templates')
export class DesignTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  categorySlug: string | null;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ nullable: true })
  thumbnailUrl: string | null;

  @Column('jsonb', { default: {} })
  canvasState: Record<string, unknown>;

  @Column({ default: true })
  isPublic: boolean;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: 0 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
