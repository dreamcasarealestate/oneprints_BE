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
   * VistaPrint-style **customer-fillable field schema**.
   *
   * When an admin authors a template they can mark certain text
   * objects on the canvas as "the customer can edit this" (e.g.
   * "Full Name", "Job Title", "Phone / Other"). Those are stored
   * here as a flat list and replayed in the studio's left-side
   * **"Fill in the fields"** form panel — the customer just fills
   * the form, the canvas updates live, no Fabric.js wrangling
   * required.
   *
   * The `slotId` connects each form input back to a Fabric object
   * (we already tag editable objects with a stable `data.slotId`
   * when the studio loads — see `applyTemplate` in
   * `ProductDesignStudio`). When `slotId` is missing the row is
   * treated as a free-form text input the admin wants surfaced
   * even though the underlying object isn't bound yet (rare; useful
   * during template authoring before the canvas is finalised).
   *
   * `defaultValue` is what shows on the canvas before the customer
   * has typed anything (matches the placeholder you see on the
   * VistaPrint thumbnail rail — "FULL NAME", "Job Title", etc.).
   *
   * Stored as jsonb so the schema can evolve (adding `maxLength`,
   * `pattern`, `multiline`, `kind: 'qr' | 'date' | 'phone'`, …)
   * without another DB migration.
   */
  @Column('jsonb', { default: [] })
  editableFields: Array<{
    /** Stable, admin-defined id we round-trip through the studio. */
    id: string;
    /** Human label shown next to the form input ("Full Name", …). */
    label: string;
    /**
     * Canvas-object handle. We tag template text objects with
     * `data.slotId === field.id` so the form input can find +
     * mutate the right Fabric object.
     */
    slotId?: string | null;
    /** Pre-populated value shown on canvas + as input placeholder. */
    defaultValue?: string | null;
    /** Optional admin-visible help text rendered under the input. */
    helperText?: string | null;
    /** Soft cap for the input. Studio also clamps the canvas text. */
    maxLength?: number | null;
    /**
     * If the template has multiple sides (e.g. front/back of a
     * visiting card) this scopes the field to a side so the form
     * only shows when the customer is on that side. Matches the
     * `sideId` we already track in the studio.
     */
    side?: string | null;
    /**
     * Future expansion: `'text' | 'qr' | 'image' | 'date' | …`.
     * Today everything is text — kept optional so older rows
     * (currently empty arrays) don't fail validation when read.
     */
    kind?: string | null;
  }>;

  /**
   * VistaPrint-style **template color palette**.
   *
   * A template can ship with N color variants (e.g. Wine Red, Black,
   * Olive, Navy) — these are the swatches the customer picks from
   * inside the studio's left-side "Template color" panel. Each
   * variant carries:
   *   - a `swatchHex` painted on the picker chip,
   *   - an optional `palette` that maps a slot id / canvas role
   *     (e.g. `bg`, `accent`, `text`) to the hex used for that
   *     swatch — the studio reads this to recolor the canvas
   *     consistently instead of guessing.
   *
   * `isDefault` flags which variant should pre-select when the
   * template loads. Stored as an array so the on-canvas chip order
   * is admin-controlled (no implicit sorting).
   */
  @Column('jsonb', { default: [] })
  colorVariants: Array<{
    /** Stable id used by the studio + cart line snapshot. */
    id: string;
    /** Human label shown under the picker chip ("Wine Red"). */
    label: string;
    /** Hex painted on the picker swatch (single representative color). */
    swatchHex: string;
    /**
     * Optional id -> hex map used to recolor specific canvas
     * elements (background, dividers, headline, etc.). Keys
     * correspond to `data.colorRole` admin tagged on the canvas
     * objects.
     */
    palette?: Record<string, string> | null;
    /** Mark exactly one variant as the on-load default. */
    isDefault?: boolean | null;
  }>;

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
