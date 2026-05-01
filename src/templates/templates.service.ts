import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, Repository } from 'typeorm';
import {
  DesignTemplate,
  TEMPLATE_STATUSES,
  type TemplateStatus,
} from './template.entity';
import { TemplateCategory } from './template-category.entity';
import { CreateTemplateDto } from './dto/create-template.dto';

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
  ) {}

  /**
   * Storefront listing — by default scoped to `approved + isPublic`.
   * Admin callers can pass `includePrivate` and `statuses` to relax the
   * filter for management UIs.
   */
  async list(opts: TemplateListOpts) {
    const where: Record<string, unknown> = {};

    if (!opts.includePrivate) where.isPublic = true;
    if (opts.statuses?.length) {
      where.status = In(opts.statuses);
    } else if (opts.status) {
      where.status = opts.status;
    } else if (!opts.includePrivate) {
      where.status = 'approved';
    }
    if (opts.featured !== undefined) where.featured = opts.featured;
    if (opts.categoryId) where.categoryId = opts.categoryId;
    else if (opts.categorySlug) where.categorySlug = opts.categorySlug;
    if (opts.search) where.title = ILike(`%${opts.search}%`);

    return this.repo.find({
      where,
      order: {
        // Featured templates always rise to the top of any listing — this
        // is what powers the "Featured" carousel on the templates page.
        featured: 'DESC',
        sortOrder: 'ASC',
        createdAt: 'DESC',
      },
      take: opts.limit ?? 48,
      skip: opts.offset ?? 0,
    });
  }

  /** Admin: every row, any status, any visibility. */
  listAll() {
    return this.repo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getOne(id: string): Promise<DesignTemplate> {
    const tpl = await this.repo.findOneBy({ id });
    if (!tpl) throw new NotFoundException('Template not found');
    // Usage count drives "trending" / sortable popularity later. Increment
    // is best-effort and isolated from the read response.
    void this.repo.increment({ id }, 'usageCount', 1).catch(() => undefined);
    return tpl;
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
  ): Promise<DesignTemplate> {
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
      tags: dto.tags ?? [],
      thumbnailUrl: dto.thumbnailUrl ?? null,
      canvasState: dto.canvasState,
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
    return this.repo.save(tpl);
  }

  async update(
    id: string,
    dto: Partial<CreateTemplateDto>,
  ): Promise<DesignTemplate> {
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
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      ...(dto.featured !== undefined && { featured: dto.featured }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.productId !== undefined && { productId: dto.productId ?? null }),
      ...(dto.width !== undefined && { width: dto.width ?? null }),
      ...(dto.height !== undefined && { height: dto.height ?? null }),
      ...(dto.status !== undefined &&
        TEMPLATE_STATUSES.includes(dto.status) && { status: dto.status }),
    });
    return this.repo.save(tpl);
  }

  async setFeatured(id: string, featured: boolean): Promise<DesignTemplate> {
    const tpl = await this.repo.findOneBy({ id });
    if (!tpl) throw new NotFoundException('Template not found');
    tpl.featured = featured;
    return this.repo.save(tpl);
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
