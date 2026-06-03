import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayOverlap, ILike, In, Repository } from 'typeorm';
import {
  DesignTemplate,
  TEMPLATE_STATUSES,
  type TemplateStatus,
} from './template.entity';
import { TemplateCategory } from './template-category.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { Product } from '../catalogue/product.entity';

/**
 * Wire response shape:
 *   - `priceFrom`: computed from `priceFromOverride` falling back
 *     to the bound product's `basePrice`. Exposed as a sibling
 *     field (instead of mutating `priceFromOverride`) so the FE
 *     always knows whether the value came from an admin-set
 *     override.
 *   - `effectiveSides`: resolved side list per the dynamic
 *     VistaPrint rule — template override → product `printSides`
 *     → category `defaultSides` → `[{id:'front',label:'Front'}]`.
 *     Always non-empty. Computed BE-side so the FE never
 *     re-implements the rule and so list views can render
 *     "5 sides" chips on cards without N+1 fetches.
 *   - `effectiveSideSources`: for the admin studio's "Sides
 *     source" pill — tells the editor whether the resolved list
 *     came from `override`, `product`, `category`, or `default`.
 *   - `effectiveUnitPrice`: the canonical unit price this
 *     template would charge today (override → product base →
 *     `null` when neither is set; variant deltas are added at
 *     pick time, not here).
 */
/**
 * Normalise a tag list to a canonical lowercase + trimmed +
 * de-duplicated form. Used on every create/update path so the
 * `ArrayOverlap` filter (which lowercases its input) can never
 * silently miss templates because an admin happened to type a
 * tag in Title Case. Returns an empty array for `undefined` /
 * `null` / non-array input so the caller doesn't have to guard.
 */
function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = String(raw ?? '')
      .trim()
      .toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export type EffectiveSideSource =
  | 'override'
  | 'product'
  | 'category'
  | 'default';

export type TemplateResponse = DesignTemplate & {
  priceFrom: number | null;
  effectiveSides: { id: string; label: string }[];
  effectiveSideSource: EffectiveSideSource;
  effectiveUnitPrice: number | null;
};

/**
 * Minimal product+category projection we need to resolve sides /
 * price. Loaded in one query per list to avoid N+1.
 */
type ProductSideMeta = {
  basePrice: number | null;
  printSides: string[] | null;
};

export type TemplateListOpts = {
  categorySlug?: string;
  categoryId?: string;
  search?: string;
  featured?: boolean;
  /** Admin / owner views can pass an explicit status filter. */
  status?: TemplateStatus;
  /** Multiple statuses for admin queue views. */
  statuses?: TemplateStatus[];
  /** When true, also returns rows where `isPublic=false` (admin only). */
  includePrivate?: boolean;
  /**
   * Optional product binding. When set:
   *   - Templates authored for THIS product (where `productId` matches)
   *     are returned first
   *   - Then templates with no product binding (`productId IS NULL`)
   *     in the same category are appended to top up the page
   *
   * This mirrors VistaPrint's "Templates for Standard Visiting Cards"
   * flow where product-specific artwork wins, with category-wide
   * fallbacks filling the rail when there isn't enough.
   */
  productId?: string;
  /**
   * Optional tag filter — array of strings OR-matched against the
   * template's `tags` column. The PDP / studio uses this to scope
   * templates to the customer's currently-picked variant (e.g. the
   * selected size, paper stock, orientation). Admins tag a template
   * with the option labels they want it to appear for.
   */
  tags?: string[];
  /**
   * Optional **shape filter** — a target aspect ratio (width /
   * height). When set we only return templates whose stored
   * `width / height` falls within ±`aspectRatioTolerance` of
   * this value (default 5%). Mirrors VistaPrint's behaviour
   * where opening a "Square Visiting Cards" PDP only ever
   * surfaces square templates: a square product never shows a
   * rectangular template card to the customer.
   *
   * Templates without explicit `width` / `height` are skipped
   * — better to omit them than to show artwork that won't
   * actually fit the printable surface.
   */
  aspectRatio?: number;
  /** ±tolerance for {@link aspectRatio} matching. Defaults to 0.05 (5%). */
  aspectRatioTolerance?: number;
  limit?: number;
  offset?: number;
};

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(DesignTemplate)
    private readonly repo: Repository<DesignTemplate>,
    @InjectRepository(TemplateCategory)
    private readonly categories: Repository<TemplateCategory>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  /**
   * Coerce the DB's `numeric` column into a JS `number` for the
   * response — TypeORM returns numerics as strings to preserve
   * precision but the FE needs a real number for comparison /
   * formatting.
   */
  private parseMoney(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  /**
   * Best-effort prettifier: `"left-sleeve" → "Left sleeve"`,
   * `"front" → "Front"`. Used when a product's `printSides` ships
   * raw ids (most do) so we can synthesize a `label` for the
   * effective side list.
   */
  private humaniseSideId(id: string): string {
    const cleaned = id.trim().replace(/[-_]+/g, ' ');
    if (!cleaned.length) return id;
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  /**
   * Normalises a value into `{id,label}[]`. Accepts:
   *   - `string[]` (product `printSides`) → derives labels.
   *   - `{id,label}[]` (category `defaultSides`, template `sides`)
   *     → keeps as-is, falls back to humanised id for any row
   *     with a missing label.
   *   - anything else → empty array.
   */
  private normaliseSides(
    raw: unknown,
  ): { id: string; label: string }[] {
    if (!Array.isArray(raw)) return [];
    const out: { id: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const entry of raw) {
      if (typeof entry === 'string') {
        const id = entry.trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ id, label: this.humaniseSideId(id) });
        continue;
      }
      if (entry && typeof entry === 'object') {
        const rec = entry as { id?: unknown; label?: unknown };
        const id = typeof rec.id === 'string' ? rec.id.trim() : '';
        if (!id || seen.has(id)) continue;
        const label =
          typeof rec.label === 'string' && rec.label.trim().length
            ? rec.label
            : this.humaniseSideId(id);
        seen.add(id);
        out.push({ id, label });
      }
    }
    return out;
  }

  /**
   * The single source of truth for "which sides does this
   * template have?". Order of precedence:
   *   1. Template-level override (`tpl.sides`) when non-null and
   *      non-empty.
   *   2. Bound product's `printSides` (when `productId` set).
   *      Labels are sourced from the resolved category's
   *      `defaultSides` when an id matches; otherwise humanised
   *      from the id.
   *   3. Resolved category's `defaultSides`.
   *   4. `[{id:'front',label:'Front'}]` (always non-empty so the
   *      studio can render at least one side).
   *
   * Pure function over the inputs the bulk loader already
   * gathers — we never call this with the live entities, only
   * with the projection.
   */
  private resolveEffectiveSides(
    tpl: DesignTemplate,
    product: ProductSideMeta | null,
    category: TemplateCategory | null,
  ): {
    sides: { id: string; label: string }[];
    source: EffectiveSideSource;
  } {
    const override = this.normaliseSides(tpl.sides);
    if (override.length > 0) {
      return { sides: override, source: 'override' };
    }
    const categoryDefaults = this.normaliseSides(category?.defaultSides);
    const labelById = new Map(categoryDefaults.map((s) => [s.id, s.label]));
    if (product?.printSides && product.printSides.length > 0) {
      const enriched = this.normaliseSides(product.printSides).map((s) => ({
        id: s.id,
        label: labelById.get(s.id) ?? s.label,
      }));
      if (enriched.length > 0) {
        return { sides: enriched, source: 'product' };
      }
    }
    if (categoryDefaults.length > 0) {
      return { sides: categoryDefaults, source: 'category' };
    }
    return {
      sides: [{ id: 'front', label: 'Front' }],
      source: 'default',
    };
  }

  /**
   * Effective unit price for a single template — pure logic over
   * the projection. Override wins, product's `basePrice` is the
   * fallback, `null` when the template is library-only and has
   * no override (the FE blocks add-to-cart in that case).
   */
  private resolveEffectiveUnitPrice(
    tpl: DesignTemplate,
    product: ProductSideMeta | null,
  ): number | null {
    const override = this.parseMoney(tpl.priceFromOverride);
    if (override !== null) return override;
    return product?.basePrice ?? null;
  }

  /**
   * Bulk-fetch the side+price projection for every productId we
   * see on a list of templates. Avoids N+1 on the storefront
   * list endpoint.
   */
  private async fetchProductSideMetaBulk(
    productIds: string[],
  ): Promise<Map<string, ProductSideMeta>> {
    const map = new Map<string, ProductSideMeta>();
    if (productIds.length === 0) return map;
    const products = await this.products.find({
      where: { id: In(productIds) },
      select: ['id', 'basePrice', 'printSides'] as (keyof Product)[],
    });
    for (const p of products) {
      map.set(p.id, {
        basePrice: this.parseMoney(p.basePrice),
        printSides: Array.isArray(p.printSides) ? p.printSides : null,
      });
    }
    return map;
  }

  /**
   * Bulk-fetch the category projection for every categoryId we
   * see on a list of templates.
   */
  private async fetchCategoryMetaBulk(
    categoryIds: string[],
  ): Promise<Map<string, TemplateCategory>> {
    const map = new Map<string, TemplateCategory>();
    if (categoryIds.length === 0) return map;
    const cats = await this.categories.find({
      where: { id: In(categoryIds) },
    });
    for (const c of cats) map.set(c.id, c);
    return map;
  }

  /**
   * Attach the computed `priceFrom` + `effectiveSides` +
   * `effectiveUnitPrice` fields to a single template.
   */
  private async attachComputed(
    tpl: DesignTemplate,
  ): Promise<TemplateResponse> {
    const product = tpl.productId
      ? await this.products.findOne({
          where: { id: tpl.productId },
          select: ['id', 'basePrice', 'printSides'] as (keyof Product)[],
        })
      : null;
    const projection: ProductSideMeta | null = product
      ? {
          basePrice: this.parseMoney(product.basePrice),
          printSides: Array.isArray(product.printSides)
            ? product.printSides
            : null,
        }
      : null;
    const category = tpl.categoryId
      ? await this.categories.findOneBy({ id: tpl.categoryId })
      : null;
    const { sides, source } = this.resolveEffectiveSides(
      tpl,
      projection,
      category,
    );
    const override = this.parseMoney(tpl.priceFromOverride);
    return {
      ...tpl,
      priceFrom: override !== null ? override : projection?.basePrice ?? null,
      effectiveSides: sides,
      effectiveSideSource: source,
      effectiveUnitPrice: this.resolveEffectiveUnitPrice(tpl, projection),
    };
  }

  /**
   * Bulk variant — single SELECT per joined table so list
   * endpoints stay O(1) DB calls regardless of result size.
   */
  private async attachComputedBulk(
    rows: DesignTemplate[],
  ): Promise<TemplateResponse[]> {
    const productIds = Array.from(
      new Set(rows.map((r) => r.productId).filter((id): id is string => !!id)),
    );
    const categoryIds = Array.from(
      new Set(rows.map((r) => r.categoryId).filter((id): id is string => !!id)),
    );
    const [productMap, categoryMap] = await Promise.all([
      this.fetchProductSideMetaBulk(productIds),
      this.fetchCategoryMetaBulk(categoryIds),
    ]);
    return rows.map((tpl) => {
      const projection = tpl.productId
        ? productMap.get(tpl.productId) ?? null
        : null;
      const category = tpl.categoryId
        ? categoryMap.get(tpl.categoryId) ?? null
        : null;
      const { sides, source } = this.resolveEffectiveSides(
        tpl,
        projection,
        category,
      );
      const override = this.parseMoney(tpl.priceFromOverride);
      return {
        ...tpl,
        priceFrom:
          override !== null ? override : projection?.basePrice ?? null,
        effectiveSides: sides,
        effectiveSideSource: source,
        effectiveUnitPrice: this.resolveEffectiveUnitPrice(tpl, projection),
      };
    });
  }

  /**
   * Storefront listing — by default scoped to `approved + isPublic`.
   * Admin callers can pass `includePrivate` and `statuses` to relax the
   * filter for management UIs.
   */
  async list(opts: TemplateListOpts) {
    const baseWhere: Record<string, unknown> = {};

    if (!opts.includePrivate) baseWhere.isPublic = true;
    if (opts.statuses?.length) {
      baseWhere.status = In(opts.statuses);
    } else if (opts.status) {
      baseWhere.status = opts.status;
    } else if (!opts.includePrivate) {
      baseWhere.status = 'approved';
    }
    if (opts.featured !== undefined) baseWhere.featured = opts.featured;
    if (opts.categoryId) baseWhere.categoryId = opts.categoryId;
    else if (opts.categorySlug) baseWhere.categorySlug = opts.categorySlug;
    if (opts.search) baseWhere.title = ILike(`%${opts.search}%`);
    // Tag filter — OR-matched against the template's `tags[]` column
    // via Postgres' `&&` array-overlap operator. Lower-case each tag
    // so the comparison is case-insensitive in the common case
    // (admins type "Standard", customers see "standard", etc.).
    const tagPool = (opts.tags ?? [])
      .map((t) => (t ?? '').toString().trim().toLowerCase())
      .filter((t) => t.length > 0);
    if (tagPool.length > 0) {
      baseWhere.tags = ArrayOverlap(tagPool);
    }

    const take = opts.limit ?? 48;
    const skip = opts.offset ?? 0;
    const order = {
      // Featured templates always rise to the top of any listing — this
      // is what powers the "Featured" carousel on the templates page.
      featured: 'DESC' as const,
      sortOrder: 'ASC' as const,
      createdAt: 'DESC' as const,
    };

    // Aspect-ratio shape filter — VistaPrint behaviour where a
    // square PDP / studio only ever surfaces square templates. We
    // post-filter in-memory after the SQL `find` because the
    // tolerance check is a divide-and-compare that doesn't index
    // well, and the page size is bounded (≤48 by default) so the
    // overhead is negligible.
    const aspectMatches = (tpl: DesignTemplate): boolean => {
      if (typeof opts.aspectRatio !== 'number' || opts.aspectRatio <= 0) {
        return true;
      }
      if (
        typeof tpl.width !== 'number' ||
        typeof tpl.height !== 'number' ||
        tpl.width <= 0 ||
        tpl.height <= 0
      ) {
        return false;
      }
      const tol =
        typeof opts.aspectRatioTolerance === 'number' &&
        opts.aspectRatioTolerance > 0
          ? opts.aspectRatioTolerance
          : 0.05;
      const ratio = tpl.width / tpl.height;
      return Math.abs(ratio - opts.aspectRatio) / opts.aspectRatio <= tol;
    };

    // We over-fetch from the DB whenever an aspect filter is
    // active so the post-filter has enough candidates to fill the
    // page — a 3× multiplier is empirically enough without
    // blowing through the table on huge catalogues.
    const overFetch = typeof opts.aspectRatio === 'number' ? take * 3 : take;

    // When the caller scopes the request to a specific product, run a
    // two-tier query so product-bound templates win the early slots
    // while category-wide fallbacks still fill the page. We dedup by
    // id so a template that matches both tiers only shows up once.
    //
    // The queries run sequentially (not Promise.all) so the second
    // call can size its `take` from what the first returned. Cost
    // is a single extra round-trip; payoff is no over-fetch on
    // products that already have a full curated rail.
    if (opts.productId) {
      const boundToProduct = await this.repo.find({
        where: { ...baseWhere, productId: opts.productId },
        order,
        take: overFetch,
        skip,
      });
      const filteredBound = boundToProduct.filter(aspectMatches);
      const topUpCount = Math.max(0, take - filteredBound.length);
      // Top up with templates that don't bind to any product (the
      // "library" templates) so a brand-new product with no curated
      // artwork still gets a useful rail. We skip pagination here —
      // it's tied to the bound query.
      const unbound =
        topUpCount > 0
          ? await this.repo.find({
              where: { ...baseWhere, productId: undefined },
              order,
              take: topUpCount * 3,
            })
          : [];
      const filteredUnbound = unbound.filter(aspectMatches);
      const seen = new Set<string>();
      const merged: DesignTemplate[] = [];
      for (const t of [...filteredBound, ...filteredUnbound]) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        merged.push(t);
        if (merged.length >= take) break;
      }
      return this.attachComputedBulk(merged);
    }

    const rows = await this.repo.find({
      where: baseWhere,
      order,
      take: overFetch,
      skip,
    });
    const filtered = rows.filter(aspectMatches).slice(0, take);
    return this.attachComputedBulk(filtered);
  }

  /** Admin: every row, any status, any visibility. */
  async listAll(): Promise<TemplateResponse[]> {
    const rows = await this.repo.find({
      order: { createdAt: 'DESC' },
    });
    return this.attachComputedBulk(rows);
  }

  async getOne(id: string): Promise<TemplateResponse> {
    const tpl = await this.repo.findOneBy({ id });
    if (!tpl) throw new NotFoundException('Template not found');
    // Usage count drives "trending" / sortable popularity later. Increment
    // is best-effort and isolated from the read response.
    void this.repo.increment({ id }, 'usageCount', 1).catch(() => undefined);
    return this.attachComputed(tpl);
  }

  /**
   * Resolves `categoryId` ↔ `categorySlug` so callers can pass either —
   * keeps slug-based legacy clients working while new clients use the
   * uuid-typed FK directly.
   */
  private async resolveCategory(input: {
    categoryId?: string | null;
    categorySlug?: string | null;
  }): Promise<{ categoryId: string | null; categorySlug: string | null }> {
    if (input.categoryId) {
      const cat = await this.categories.findOneBy({ id: input.categoryId });
      if (!cat) throw new BadRequestException('Unknown template categoryId');
      return { categoryId: cat.id, categorySlug: cat.slug };
    }
    if (input.categorySlug) {
      const cat = await this.categories.findOneBy({
        slug: input.categorySlug,
      });
      return {
        categoryId: cat?.id ?? null,
        categorySlug: input.categorySlug,
      };
    }
    return { categoryId: null, categorySlug: null };
  }

  /**
   * Admin path — bypasses the approval queue (`status='approved'` by
   * default). Use `submitFromUser` for end-user submissions.
   */
  async create(
    dto: CreateTemplateDto,
    actor: { id: string },
  ): Promise<TemplateResponse> {
    const cat = await this.resolveCategory({
      categoryId: dto.categoryId,
      categorySlug: dto.categorySlug,
    });

    const status =
      dto.status && TEMPLATE_STATUSES.includes(dto.status)
        ? dto.status
        : 'approved';

    const now = new Date();

    const tpl = this.repo.create({
      title: dto.title,
      categorySlug: cat.categorySlug,
      categoryId: cat.categoryId,
      productId: dto.productId ?? null,
      width: dto.width ?? null,
      height: dto.height ?? null,
      // Per-template side override. Empty array is normalised to
      // null so the resolver knows to fall through to product /
      // category defaults (matches PATCH semantics).
      sides:
        dto.sides && Array.isArray(dto.sides) && dto.sides.length > 0
          ? dto.sides.map((s) => ({ id: s.id, label: s.label }))
          : null,
      // Admin-authored custom sections — same shape as
      // `Product.customSections`, jsonb passthrough.
      customSections: dto.customSections ?? [],
      // Persist the admin's "From ₹X" override as a string so
      // TypeORM round-trips numeric precision correctly. `null`
      // means "fall back to bound product's basePrice" on the
      // response's `priceFrom` field.
      priceFromOverride:
        dto.priceFromOverride !== undefined && dto.priceFromOverride !== null
          ? String(dto.priceFromOverride)
          : null,
      // Persist tags lowercased + de-duped so the `ArrayOverlap`
      // filter (which lowercases its input) always matches
      // regardless of how the admin typed the tag in the form.
      // Without this an admin who types "Restaurant" would
      // silently break the storefront filter that searches for
      // "restaurant".
      tags: normalizeTags(dto.tags),
      thumbnailUrl: dto.thumbnailUrl ?? null,
      canvasState: dto.canvasState,
      // VistaPrint-style admin-authored form + palette. Default to
      // empty arrays so legacy templates (banners, flyers, …) that
      // never had these surfaces still parse cleanly.
      editableFields: dto.editableFields ?? [],
      colorVariants: dto.colorVariants ?? [],
      isPublic: dto.isPublic ?? true,
      featured: dto.featured ?? false,
      status,
      sortOrder: dto.sortOrder ?? 0,
      submittedById: actor.id,
      submittedAt: now,
      approvedById: status === 'approved' ? actor.id : null,
      approvedAt: status === 'approved' ? now : null,
      publishedAt: status === 'approved' ? now : null,
    });
    const saved = await this.repo.save(tpl);
    return this.attachComputed(saved);
  }

  async update(
    id: string,
    dto: Partial<CreateTemplateDto>,
  ): Promise<TemplateResponse> {
    const tpl = await this.repo.findOneBy({ id });
    if (!tpl) throw new NotFoundException('Template not found');

    if (dto.categoryId !== undefined || dto.categorySlug !== undefined) {
      const cat = await this.resolveCategory({
        categoryId: dto.categoryId ?? null,
        categorySlug: dto.categorySlug ?? null,
      });
      tpl.categoryId = cat.categoryId;
      tpl.categorySlug = cat.categorySlug;
    }

    Object.assign(tpl, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.tags !== undefined && { tags: normalizeTags(dto.tags) }),
      ...(dto.thumbnailUrl !== undefined && { thumbnailUrl: dto.thumbnailUrl }),
      ...(dto.canvasState !== undefined && { canvasState: dto.canvasState }),
      // Form schema + palette PATCH semantics: undefined means
      // "leave as is", null/empty arrays explicitly clear them
      // (admin re-authored a template that no longer needs a form).
      ...(dto.editableFields !== undefined && {
        editableFields: dto.editableFields ?? [],
      }),
      ...(dto.colorVariants !== undefined && {
        colorVariants: dto.colorVariants ?? [],
      }),
      ...(dto.sides !== undefined && {
        sides:
          dto.sides && Array.isArray(dto.sides) && dto.sides.length > 0
            ? dto.sides.map((s) => ({ id: s.id, label: s.label }))
            : null,
      }),
      ...(dto.customSections !== undefined && {
        customSections: dto.customSections ?? [],
      }),
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      ...(dto.featured !== undefined && { featured: dto.featured }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.productId !== undefined && { productId: dto.productId ?? null }),
      ...(dto.width !== undefined && { width: dto.width ?? null }),
      ...(dto.height !== undefined && { height: dto.height ?? null }),
      ...(dto.priceFromOverride !== undefined && {
        priceFromOverride:
          dto.priceFromOverride === null
            ? null
            : String(dto.priceFromOverride),
      }),
      ...(dto.status !== undefined &&
        TEMPLATE_STATUSES.includes(dto.status) && { status: dto.status }),
    });
    const saved = await this.repo.save(tpl);
    return this.attachComputed(saved);
  }

  async setFeatured(id: string, featured: boolean): Promise<TemplateResponse> {
    const tpl = await this.repo.findOneBy({ id });
    if (!tpl) throw new NotFoundException('Template not found');
    tpl.featured = featured;
    const saved = await this.repo.save(tpl);
    return this.attachComputed(saved);
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const tpl = await this.repo.findOneBy({ id });
    if (!tpl) throw new NotFoundException('Template not found');
    await this.repo.remove(tpl);
    return { id, deleted: true };
  }

  /**
   * One-time backfill helper called from the seed service. For every
   * template that has a `categorySlug` but no `categoryId`, look up the
   * matching `TemplateCategory` row and link them. Safe to run on
   * every boot — it's a no-op once everything is linked.
   */
  async backfillCategoryIds(): Promise<void> {
    const orphans = await this.repo.find({
      where: { categoryId: null },
    });
    if (!orphans.length) return;

    const slugs = Array.from(
      new Set(orphans.map((o) => o.categorySlug).filter(Boolean) as string[]),
    );
    if (!slugs.length) return;

    const cats = await this.categories.find({ where: { slug: In(slugs) } });
    const bySlug = new Map(cats.map((c) => [c.slug, c]));

    for (const tpl of orphans) {
      if (!tpl.categorySlug) continue;
      const match = bySlug.get(tpl.categorySlug);
      if (!match) continue;
      tpl.categoryId = match.id;
      await this.repo.save(tpl);
    }
  }
}
