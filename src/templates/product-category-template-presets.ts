/**
 * Canvas / sides / bleed presets for **template categories that are
 * auto-provisioned from {@link CANONICAL_CATEGORIES product canonical
 * slugs}**.
 *
 * Why this file exists
 * ────────────────────
 * The two taxonomies on the platform — `ProductCategory` (catalogue
 * merchandise: apparel, drinkware, visiting_cards, …) and
 * `TemplateCategory` (canvas-author kinds: flyer, banner, …) — used
 * to be entirely disjoint, with only `apparel` + `stationery`
 * sharing exact slugs by accident. That meant admins couldn't pick
 * "Visiting cards" or "Labels" or "Stickers" when authoring a
 * template, even though those are some of the most-printed product
 * categories on the storefront.
 *
 * VistaPrint-parity requires templates to exist for **every** product
 * category. To get there without throwing canvas dimensions / sides /
 * bleed away, we auto-create one TemplateCategory row per product
 * canonical slug at boot — using the presets in this file for the
 * canvas defaults. The created row also carries a
 * `productCategorySlug` back-link so the studio's product-binder
 * filter can find the matching merchandise in O(1).
 *
 * Rules of thumb for these presets
 * ────────────────────────────────
 * • **Flat-sheet print products** (visiting cards, labels, stickers,
 *   packaging, stationery wrappers) → CSS pixel dims derived from
 *   the physical size at 100 DPI (close enough to design-canvas
 *   resolution; the print pipeline rasterises at final DPI).
 * • **Wearables / mockup-driven** (apparel, drinkware, bags, tech
 *   accessories) → 800–1000px on the long edge, single-side or
 *   front/back depending on what most products in the category
 *   carry. The canvas is rendered over a product mockup at the
 *   studio level, so dims here only need to feel right relative to
 *   the mockup.
 * • **Catch-all / mixed** (promo, corporate gifting, awards) →
 *   square 1080 / portrait 800×1000 — admins can override at the
 *   per-template level once a real product shape locks in.
 *
 * Slug convention
 * ───────────────
 * The TemplateCategory DTO enforces kebab-case slugs (no underscores)
 * while product slugs are snake_case. We normalise here:
 *   `visiting_cards` ⇄ `visiting-cards`
 *   `tech_accessories` ⇄ `tech-accessories`
 *   `corporate_gifting` ⇄ `corporate-gifting`
 * The `productCategorySlug` column always stores the **product**
 * spelling so joins / lookups stay unambiguous.
 */
import { CANONICAL_CATEGORIES } from '../catalogue/canonical-categories';

/**
 * Per-product-category preset. `slug` here is the **template**
 * (kebab-case) form; `productCategorySlug` is the **product**
 * (snake_case) form we round-trip through the catalogue.
 */
export type ProductCategoryTemplatePreset = {
  /** Kebab-case slug used for the auto-provisioned TemplateCategory. */
  slug: string;
  /** Human-readable name shown in the admin dropdown + storefront. */
  name: string;
  /** Short description shown in the manage-categories admin table. */
  description: string;
  /** Source product slug (snake_case). */
  productCategorySlug: string;
  /** Canvas width in CSS pixels. */
  defaultCanvasWidth: number;
  /** Canvas height in CSS pixels. */
  defaultCanvasHeight: number;
  /** Bleed in pixels (added to all four sides at print time). */
  defaultBleedPx: number;
  /** Multi-side definition; single-side is `[{ id:'front', label:'Front' }]`. */
  defaultSides: { id: string; label: string }[];
};

/**
 * Normalise a product slug (`visiting_cards`) into its template-side
 * kebab-case form (`visiting-cards`). Pure string transform — no
 * I/O. The TemplateCategory DTO regex forbids `_`, so this is the
 * conversion the sync logic always runs.
 */
export function productSlugToTemplateSlug(productSlug: string): string {
  return productSlug.replace(/_/g, '-');
}

/**
 * Overrides per product slug. Anything not listed falls back to a
 * sane 1080×1080 square in {@link defaultPresetFor}, so the sync
 * never fails on a new merchandise category — admins just get a
 * generic canvas they can resize later.
 */
const OVERRIDES: Record<
  string,
  Omit<
    ProductCategoryTemplatePreset,
    'slug' | 'productCategorySlug' | 'name'
  >
> = {
  // Flat-sheet paper products — sized from physical card / sheet dims.
  visiting_cards: {
    description: 'Standard 3.5×2 in visiting / business cards (front + back).',
    defaultCanvasWidth: 1050,
    defaultCanvasHeight: 600,
    defaultBleedPx: 12,
    defaultSides: [
      { id: 'front', label: 'Front' },
      { id: 'back', label: 'Back' },
    ],
  },
  labels: {
    description: 'Adhesive product labels — rectangular / oval / die-cut.',
    defaultCanvasWidth: 600,
    defaultCanvasHeight: 400,
    defaultBleedPx: 12,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  stickers: {
    description: 'Square / circle / die-cut stickers for branding & merch.',
    defaultCanvasWidth: 400,
    defaultCanvasHeight: 400,
    defaultBleedPx: 12,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  packaging: {
    description: 'Boxes, mailers, sleeves — single-panel flat layouts.',
    defaultCanvasWidth: 1200,
    defaultCanvasHeight: 800,
    defaultBleedPx: 24,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  stationery: {
    description: 'Letterheads, envelopes, notepads.',
    defaultCanvasWidth: 794,
    defaultCanvasHeight: 1123,
    defaultBleedPx: 12,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  office: {
    description: 'Folders, notebooks, planners and similar office goods.',
    defaultCanvasWidth: 800,
    defaultCanvasHeight: 600,
    defaultBleedPx: 12,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  // Wearable / mockup-driven products.
  apparel: {
    description: 'T-shirts, hoodies, caps — front + back print zones.',
    defaultCanvasWidth: 800,
    defaultCanvasHeight: 600,
    defaultBleedPx: 0,
    defaultSides: [
      { id: 'front', label: 'Front' },
      { id: 'back', label: 'Back' },
    ],
  },
  drinkware: {
    description: 'Mugs, bottles, tumblers — single-side wrap canvas.',
    defaultCanvasWidth: 1000,
    defaultCanvasHeight: 600,
    defaultBleedPx: 0,
    defaultSides: [{ id: 'front', label: 'Wrap' }],
  },
  bags: {
    description: 'Tote bags, drawstring bags, backpacks.',
    defaultCanvasWidth: 1000,
    defaultCanvasHeight: 800,
    defaultBleedPx: 0,
    defaultSides: [
      { id: 'front', label: 'Front' },
      { id: 'back', label: 'Back' },
    ],
  },
  tech_accessories: {
    description: 'Phone cases, mousepads, sleeves, USB drives.',
    defaultCanvasWidth: 800,
    defaultCanvasHeight: 600,
    defaultBleedPx: 0,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  // Catch-all / mixed buckets.
  awards: {
    description: 'Trophies, plaques, certificates.',
    defaultCanvasWidth: 800,
    defaultCanvasHeight: 1000,
    defaultBleedPx: 0,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  promo: {
    description: 'Promotional merchandise — square layout fits most surfaces.',
    defaultCanvasWidth: 1080,
    defaultCanvasHeight: 1080,
    defaultBleedPx: 0,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  corporate_gifting: {
    description: 'Branded gift sets, hampers, occasion-specific bundles.',
    defaultCanvasWidth: 1080,
    defaultCanvasHeight: 1080,
    defaultBleedPx: 0,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  corporate: {
    description: 'Corporate branding kits, employee onboarding swag.',
    defaultCanvasWidth: 1080,
    defaultCanvasHeight: 1080,
    defaultBleedPx: 0,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
};

/**
 * Fallback when a brand-new product category lands in
 * {@link CANONICAL_CATEGORIES} and we haven't authored a preset
 * for it yet — keeps the sync resilient.
 */
function defaultPresetFor(): Omit<
  ProductCategoryTemplatePreset,
  'slug' | 'productCategorySlug' | 'name'
> {
  return {
    description: 'Auto-provisioned from a product category — adjust as needed.',
    defaultCanvasWidth: 1080,
    defaultCanvasHeight: 1080,
    defaultBleedPx: 0,
    defaultSides: [{ id: 'front', label: 'Front' }],
  };
}

/**
 * Build the full sync set — one preset per canonical product
 * category, with canvas defaults + the source slug. Stable
 * iteration order (mirrors the catalogue sort order) so created-at
 * timestamps in the DB reflect the canonical list.
 */
export const PRODUCT_CATEGORY_TEMPLATE_PRESETS: ProductCategoryTemplatePreset[] =
  CANONICAL_CATEGORIES.map((cat) => {
    const override = OVERRIDES[cat.slug] ?? defaultPresetFor();
    return {
      slug: productSlugToTemplateSlug(cat.slug),
      name: cat.name,
      productCategorySlug: cat.slug,
      ...override,
    };
  });
