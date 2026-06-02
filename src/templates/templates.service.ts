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
 * Wire response shape: the entity row with `priceFrom` computed
 * from `priceFromOverride` falling back to the bound product's
 * `basePrice`. We expose it as a sibling field (instead of
 * mutating `priceFromOverride`) so the FE always knows whether
 * the value came from an admin-set override.
 */
export type TemplateResponse = DesignTemplate & {
  priceFrom: number | null;
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
   * Attach the computed `priceFrom` field to a single template.
   * Order: admin override → bound product `basePrice` → null.
   */
  private async attachPriceFrom(
    tpl: DesignTemplate,
  ): Promise<TemplateResponse> {
    const override = this.parseMoney(tpl.priceFromOverride);
    if (override !== null) {
      return { ...tpl, priceFrom: override };
    }
    if (tpl.productId) {
      const product = await this.products.findOne({
        where: { id: tpl.productId },
        select: ['id', 'basePrice'] as (keyof Product)[],
      });
      const basePrice = this.parseMoney(product?.basePrice);
      return { ...tpl, priceFrom: basePrice };
    }
    return { ...tpl, priceFrom: null };
  }

  /**
   * Bulk variant of {@link attachPriceFrom} — single SELECT for
   * every productId on the page so the list endpoint stays
   * O(1) DB calls regardless of result size.
   */
  private async attachPriceFromBulk(
    rows: DesignTemplate[],
  ): Promise<TemplateResponse[]> {
    const productIds = Array.from(
      new Set(rows.map((r) => r.productId).filter((id): id is string => !!id)),
    );
    const productPriceById = new Map<string, number | null>();
    if (productIds.length > 0) {
      const products = await this.products.find({
        where: { id: In(productIds) },
        select: ['id', 'basePrice'] as (keyof Product)[],
      });
      for (const p of products) {
        productPriceById.set(p.id, this.parseMoney(p.basePrice));
      }
    }
    return rows.map((tpl) => {
      const override = this.parseMoney(tpl.priceFromOverride);
      if (override !== null) return { ...tpl, priceFrom: override };
      const productPrice = tpl.productId
        ? productPriceById.get(tpl.productId) ?? null
        : null;
      return { ...tpl, priceFrom: productPrice };
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
        take,
        skip,
      });
      const topUpCount = Math.max(0, take - boundToProduct.length);
      // Top up with templates that don't bind to any product (the
      // "library" templates) so a brand-new product with no curated
      // artwork still gets a useful rail. We skip pagination here —
      // it's tied to the bound query.
      const unbound =
        topUpCount > 0
          ? await this.repo.find({
              where: { ...baseWhere, productId: undefined },
              order,
              take: topUpCount,
            })
          : [];
      const seen = new Set<string>();
      const merged: DesignTemplate[] = [];
      for (const t of [...boundToProduct, ...unbound]) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        merged.push(t);
        if (merged.length >= take) break;
      }
      return this.attachPriceFromBulk(merged);
    }

    const rows = await this.repo.find({
      where: baseWhere,
      order,
      take,
      skip,
    });
    return this.attachPriceFromBulk(rows);
  }

  /** Admin: every row, any status, any visibility. */
  async listAll(): Promise<TemplateResponse[]> {
    const rows = await this.repo.find({
      order: { createdAt: 'DESC' },
    });
    return this.attachPriceFromBulk(rows);
  }

  async getOne(id: string): Promise<TemplateResponse> {
    const tpl = await this.repo.findOneBy({ id });
    if (!tpl) throw new NotFoundException('Template not found');
    // Usage count drives "trending" / sortable popularity later. Increment
    // is best-effort and isolated from the read response.
    void this.repo.increment({ id }, 'usageCount', 1).catch(() => undefined);
    return this.attachPriceFrom(tpl);
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
      // Persist the admin's "From ₹X" override as a string so
      // TypeORM round-trips numeric precision correctly. `null`
      // means "fall back to bound product's basePrice" on the
      // response's `priceFrom` field.
      priceFromOverride:
        dto.priceFromOverride !== undefined && dto.priceFromOverride !== null
          ? String(dto.priceFromOverride)
          : null,
      tags: dto.tags ?? [],
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
    return this.attachPriceFrom(saved);
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
      ...(dto.tags !== undefined && { tags: dto.tags }),
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
    return this.attachPriceFrom(saved);
  }

  async setFeatured(id: string, featured: boolean): Promise<TemplateResponse> {
    const tpl = await this.repo.findOneBy({ id });
    if (!tpl) throw new NotFoundException('Template not found');
    tpl.featured = featured;
    const saved = await this.repo.save(tpl);
    return this.attachPriceFrom(saved);
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
