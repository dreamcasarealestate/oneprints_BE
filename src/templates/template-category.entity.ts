import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A managed taxonomy of template "kinds" (Flyer, Banner, Brochure, …).
 *
 * The `defaultCanvas*` fields drive the **free-form editor mode** — when
 * a user opens a template that is NOT tied to a `Product`, the canvas
 * dimensions and side list come from the category. This is what makes
 * banners / flyers / brochures designable without first existing as
 * SKUs in the catalogue.
 */
@Entity('template_categories')
export class TemplateCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 80 })
  slug: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  iconUrl: string | null;

  @Column({ type: 'text', nullable: true })
  coverUrl: string | null;

  /** Default canvas width in CSS pixels (96 DPI). */
  @Column({ type: 'int', default: 800 })
  defaultCanvasWidth: number;

  /** Default canvas height in CSS pixels (96 DPI). */
  @Column({ type: 'int', default: 600 })
  defaultCanvasHeight: number;

  /** Default bleed in pixels (added to all four sides at print time). */
  @Column({ type: 'int', default: 0 })
  defaultBleedPx: number;

  /**
   * Side definitions for multi-side templates. Brochures = 2 sides, most
   * banners/flyers = 1. Persisted as `[{ id, label }]`.
   */
  @Column('jsonb', { default: () => `'[{"id":"front","label":"Front"}]'` })
  defaultSides: { id: string; label: string }[];

  /** Optional print-related metadata (DPI, color profile, paper stock …). */
  @Column('jsonb', { default: {} })
  printSpec: Record<string, unknown>;

  /**
   * Optional **soft link** to a {@link ProductCategory} slug
   * (e.g. `visiting_cards`, `labels`, `stickers`, `packaging`,
   * `apparel`).
   *
   * The two taxonomies use different slug conventions (catalogue
   * uses snake_case, templates kebab-case) so we can't compare
   * slugs directly. This column lets the template category say
   * "I represent THIS product category" — used by:
   *
   *   • the admin template authoring studio's product-binder
   *     filter (narrow the picker to products in the matched
   *     product category, instead of relying on accidental slug
   *     equality which broke for `visiting_cards` ↔ `business-card`),
   *   • the customer's `EditorTemplatesPanel` / PDP rail when
   *     ranking templates for a product (find the matching
   *     template category for the product's slug),
   *   • analytics / reporting joins.
   *
   * Nullable for legacy design-kind rows (flyer, banner, brochure,
   * poster, social) that don't map onto a single product category.
   */
  @Index()
  @Column({ type: 'text', nullable: true })
  productCategorySlug: string | null;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
