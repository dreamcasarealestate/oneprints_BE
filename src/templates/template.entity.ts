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

  /**
   * Optional admin-set **"starting from" price** for this template
   * (in the storefront's base currency, e.g. INR). When present we
   * surface it on every template card as the "From ₹X" pill —
   * matches VistaPrint's behaviour where every template tile shows
   * a price you can compare at a glance.
   *
   * Resolution order (FE):
   *   1. `priceFromOverride` — when admin set an explicit value
   *      (e.g. promotional, bundle, premium template).
   *   2. Bound product's `basePrice` — when no override but the
   *      template binds to a product (BE joins it via the
   *      `priceFrom` computed field on the response).
   *   3. Hide the pill — library templates that don't bind to a
   *      product and have no override (rare; pricing is
   *      resolved on the detail-page product picker instead).
   *
   * Stored as `numeric` to preserve money precision; FE coerces
   * to a `number` for rendering.
   */
  @Column({ type: 'numeric', nullable: true })
  priceFromOverride: string | null;

  /** Override canvas width (px). Falls back to category default if null. */
  @Column({ type: 'int', nullable: true })
  width: number | null;

  /** Override canvas height (px). Falls back to category default if null. */
  @Column({ type: 'int', nullable: true })
  height: number | null;

  /**
   * Optional **per-template side override**. When set, the
   * customer studio + admin authoring studio use this list
   * verbatim — overrides both the bound product's `printSides`
   * and the category's `defaultSides`. Use cases:
   *   - Drinkware template that only authors the wrap (not the
   *     product's `front`/`back` blank IDs).
   *   - Apparel template that targets a single sleeve.
   *   - Library templates that ship without a product binding
   *     but want a side list richer than the category default.
   *
   * `null` (the common case) means "inherit per resolution rule":
   * bound product's `printSides` → category's `defaultSides` →
   * default `[{id:'front',label:'Front'}]`. The BE computes the
   * resolved list as `effectiveSides` on every response so the FE
   * never re-implements this rule.
   *
   * Each row stores a stable `id` (matches `data.side` on the
   * canvas + slot/variant `side` metadata) plus a human `label`.
   */
  @Column('jsonb', { nullable: true })
  sides: { id: string; label: string }[] | null;

  /**
   * VistaPrint-style **template-level custom sections** — extra
   * structured form data the customer must fill when ordering
   * (e.g. "Engraving message", "Gift wrap option", "Preferred
   * proofing turnaround"). Mirrors `Product.customSections` so the
   * admin can reuse `CustomSectionsBuilder` verbatim.
   *
   * Each section carries one or more fields (`text`, `textarea`,
   * `number`, `select`, …) with `visibility` (`storefront` /
   * `admin` / `both`) and `required` flags. The storefront
   * renders `visibility === 'storefront' | 'both'` sections in
   * the studio + design review; the admin order detail panel
   * renders every section grouped by id.
   *
   * Stored as a jsonb array — the BE doesn't introspect the
   * payload so the schema can grow (new field kinds, conditional
   * visibility, etc.) without a DTO churn.
   */
  @Column('jsonb', { default: [] })
  customSections: Record<string, unknown>[];

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
    /**
     * Optional **per-variant preview image** (S3 / public URL).
     * When set, storefront cards (PDP rail, browse grid, studio
     * templates panel) swap the card thumbnail to this image when
     * the customer hovers / clicks the variant's color dot —
     * matches VistaPrint's behaviour where each colour shows a
     * different rendered preview rather than a programmatic
     * recolor of the same image. Omit to fall back to the
     * template's main `thumbnailUrl`.
     */
    thumbnailUrl?: string | null;
    /**
     * Optional **per-side preview images** keyed by side id
     * (`{ front: "...", back: "..." }`). Authored from the
     * admin studio when a single variant ships **different
     * artwork per side** — e.g. a Wine Red business card whose
     * front uses photo A and whose back uses photo B. The
     * customer studio switches to the matching image when the
     * customer flips sides; the storefront card still uses
     * {@link thumbnailUrl} so a single preview is shown.
     */
    thumbnailUrlBySide?: Record<string, string | null> | null;
    /**
     * **Canvas-rendered preview** — populated automatically by
     * the admin studio every time the admin captures the canvas
     * (Capture canvas / Use on canvas / template Save). Stored
     * as a base64 PNG so the storefront can render the
     * VistaPrint-style "Company Name / Job Title" preview
     * without re-rasterising the canvas at request time.
     *
     * Preferred over {@link thumbnailUrl} on every card display
     * surface (PDP rail, browse grid, editor templates panel,
     * change-template drawer, side-change sheet) because it's
     * an actual snapshot of the canvas with all slot
     * placeholders composited on top of the variant's
     * background — what the customer actually sees in the
     * editor — instead of just the raw uploaded background.
     */
    renderedThumbnailUrl?: string | null;
    /**
     * Optional **per-side canvas-rendered previews** keyed by
     * side id — mirrors {@link thumbnailUrlBySide} but for the
     * auto-captured canvas snapshots. The customer studio
     * picks the active side's rendered snapshot when applying
     * the variant so each side shows its own "Company Name /
     * Job Title" preview instead of an inert background photo.
     */
    renderedThumbnailUrlBySide?: Record<string, string | null> | null;
    /**
     * Optional **per-variant curated canvas state**. When the
     * admin authored a hand-tuned canvas for this colour (e.g.
     * the wine version uses different ornaments than the navy
     * version), the studio's "Template color" panel loads this
     * directly instead of running the heuristic recolor on the
     * default `canvasState`. Same shape as the parent
     * `canvasState` — flat Fabric scene, `{ state }` wrapper, or
     * multi-side `{ sideStates }` wrapper are all accepted by the
     * studio loader.
     *
     * For multi-side authoring, this column carries the
     * `{ sideStates: { front, back, ... } }` envelope so each
     * side can have its own canvas snapshot (image + slot
     * layers). The customer studio picks the active side's
     * entry when applying the variant.
     */
    canvasState?: Record<string, unknown> | null;
    /**
     * Optional **price delta** applied on top of the bound
     * product's unit price when the customer picks this colour
     * variant — VistaPrint's "Premium foil +₹10" pattern.
     * Positive numbers add, negatives discount. Zero / null are
     * treated identically and skip the chip in the cart.
     *
     * The studio passes this through `meta.templateColorVariantPriceDelta`
     * onto the cart line so cart, order, invoice and reorder all
     * apply the same delta without an extra fetch.
     */
    priceDelta?: number | null;
    /**
     * Optional **side** this variant applies to (e.g. `"front"` /
     * `"back"`). When present the customer studio only surfaces
     * the variant in the "Template color" picker while the
     * customer is editing that side — matches VistaPrint's
     * front/back-independent colour rails. Leave `null` for a
     * universal variant that applies to every side.
     */
    side?: string | null;
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
