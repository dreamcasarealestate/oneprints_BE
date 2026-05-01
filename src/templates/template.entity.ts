import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type TemplateStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export const TEMPLATE_STATUSES: TemplateStatus[] = [
  'draft',
  'pending',
  'approved',
  'rejected',
];

@Entity('design_templates')
export class DesignTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  /**
   * Legacy slug column — preserved for backwards compatibility with
   * editor sidebar code that filters by string slug. New code should
   * prefer `categoryId`. Backfilled from `categoryId.slug` on save.
   */
  @Column({ nullable: true })
  categorySlug: string | null;

  /** FK to `TemplateCategory`. Nullable for legacy rows. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  /**
   * Optional Product this template renders on top of (Hybrid mode):
   * - If set → editor opens in product-backed mode (uses product's
   *   blank/sides/colors). Same flow as `/shop/products/:id/design`.
   * - If null → free-form mode. Canvas size comes from `width/height`
   *   or from the category defaults.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  /** Override canvas width (px). Falls back to category default if null. */
  @Column({ type: 'int', nullable: true })
  width: number | null;

  /** Override canvas height (px). Falls back to category default if null. */
  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column({ nullable: true })
  thumbnailUrl: string | null;

  @Column('jsonb', { default: {} })
  canvasState: Record<string, unknown>;

  /**
   * Whether the template is publicly listed at all. Combined with
   * `status='approved'` to determine actual visibility on the storefront.
   * Authors can flip this to false to "unpublish" their own approved
   * templates without deleting them.
   */
  @Column({ default: true })
  isPublic: boolean;

  /**
   * Lifecycle:
   *   - Admin-created templates default to `approved` and skip review.
   *   - User-submitted templates start at `pending` and require admin
   *     action via the templates queue.
   *   - `rejected` templates keep their submission record but are not
   *     visible in any public list.
   */
  @Index()
  @Column({ type: 'varchar', length: 16, default: 'approved' })
  status: TemplateStatus;

  /** Curated highlight on the storefront's templates landing page. */
  @Index()
  @Column({ default: false })
  featured: boolean;

  // ── Authorship / approval audit ────────────────────────────────────
  // Mirrors the Designer onboarding workflow (`approvedBy/rejectedBy/...`).
  // All optional so legacy rows and admin-direct creates remain valid.

  @Index()
  @Column({ type: 'uuid', nullable: true })
  submittedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  rejectedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: 0 })
  usageCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
