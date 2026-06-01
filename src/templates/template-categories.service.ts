import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TemplateCategory } from './template-category.entity';
import { CreateTemplateCategoryDto } from './dto/create-template-category.dto';
import { UpdateTemplateCategoryDto } from './dto/update-template-category.dto';
import { PRODUCT_CATEGORY_TEMPLATE_PRESETS } from './product-category-template-presets';

/**
 * Canonical bootstrap categories. Seeded on module init so admins always
 * have something to start from and storefront chips render even on a
 * fresh DB. Edits made via the admin UI are preserved (we only insert
 * missing slugs, never overwrite existing rows).
 */
const DEFAULT_CATEGORIES: Omit<
  CreateTemplateCategoryDto,
  'sortOrder' | 'isActive'
>[] = [
  {
    slug: 'flyer',
    name: 'Flyers',
    description: 'A4 / A5 single-sided promotional flyers.',
    defaultCanvasWidth: 794,
    defaultCanvasHeight: 1123,
    defaultBleedPx: 12,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  {
    slug: 'banner',
    name: 'Banners',
    description: 'Wide format banners for events, shopfronts and signage.',
    defaultCanvasWidth: 1600,
    defaultCanvasHeight: 800,
    defaultBleedPx: 24,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  {
    slug: 'brochure',
    name: 'Brochures',
    description: 'Two-sided / multi-fold brochures for product catalogues.',
    defaultCanvasWidth: 1123,
    defaultCanvasHeight: 794,
    defaultBleedPx: 12,
    defaultSides: [
      { id: 'front', label: 'Outside' },
      { id: 'back', label: 'Inside' },
    ],
  },
  {
    slug: 'poster',
    name: 'Posters',
    description: 'Large-format posters for retail and events.',
    defaultCanvasWidth: 1080,
    defaultCanvasHeight: 1350,
    defaultBleedPx: 18,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  {
    slug: 'business-card',
    name: 'Business Cards',
    description: 'Standard 3.5×2 in business cards (front + back).',
    defaultCanvasWidth: 1050,
    defaultCanvasHeight: 600,
    defaultBleedPx: 12,
    defaultSides: [
      { id: 'front', label: 'Front' },
      { id: 'back', label: 'Back' },
    ],
  },
  {
    slug: 'social',
    name: 'Social Media',
    description: '1:1 / 4:5 graphics for Instagram, LinkedIn and beyond.',
    defaultCanvasWidth: 1080,
    defaultCanvasHeight: 1080,
    defaultBleedPx: 0,
    defaultSides: [{ id: 'front', label: 'Post' }],
  },
  {
    slug: 'stationery',
    name: 'Stationery',
    description: 'Letterheads, envelopes, notepads and similar.',
    defaultCanvasWidth: 794,
    defaultCanvasHeight: 1123,
    defaultBleedPx: 12,
    defaultSides: [{ id: 'front', label: 'Front' }],
  },
  {
    slug: 'apparel',
    name: 'Apparel',
    description: 'T-shirts, hoodies, caps — when the template ties to a product.',
    defaultCanvasWidth: 800,
    defaultCanvasHeight: 600,
    defaultBleedPx: 0,
    defaultSides: [
      { id: 'front', label: 'Front' },
      { id: 'back', label: 'Back' },
    ],
  },
];

@Injectable()
export class TemplateCategoriesService {
  constructor(
    @InjectRepository(TemplateCategory)
    private readonly repo: Repository<TemplateCategory>,
  ) {}

  list(opts: { activeOnly?: boolean } = {}) {
    const where = opts.activeOnly ? { isActive: true } : {};
    return this.repo.find({
      where,
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findBySlug(slug: string): Promise<TemplateCategory> {
    const row = await this.repo.findOneBy({ slug });
    if (!row) throw new NotFoundException('Template category not found');
    return row;
  }

  async findById(id: string): Promise<TemplateCategory> {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException('Template category not found');
    return row;
  }

  async create(dto: CreateTemplateCategoryDto): Promise<TemplateCategory> {
    const existing = await this.repo.findOneBy({ slug: dto.slug });
    if (existing) {
      throw new ConflictException(
        `Template category with slug "${dto.slug}" already exists`,
      );
    }
    const row = this.repo.create({
      slug: dto.slug,
      name: dto.name,
      description: dto.description ?? null,
      iconUrl: dto.iconUrl ?? null,
      coverUrl: dto.coverUrl ?? null,
      defaultCanvasWidth: dto.defaultCanvasWidth,
      defaultCanvasHeight: dto.defaultCanvasHeight,
      defaultBleedPx: dto.defaultBleedPx ?? 0,
      defaultSides: dto.defaultSides ?? [{ id: 'front', label: 'Front' }],
      printSpec: dto.printSpec ?? {},
      productCategorySlug: dto.productCategorySlug ?? null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(row);
  }

  async update(
    id: string,
    dto: UpdateTemplateCategoryDto,
  ): Promise<TemplateCategory> {
    const row = await this.findById(id);
    if (dto.slug && dto.slug !== row.slug) {
      const dup = await this.repo.findOneBy({ slug: dto.slug });
      if (dup && dup.id !== id) {
        throw new ConflictException(
          `Template category with slug "${dto.slug}" already exists`,
        );
      }
    }
    Object.assign(row, {
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.iconUrl !== undefined && { iconUrl: dto.iconUrl }),
      ...(dto.coverUrl !== undefined && { coverUrl: dto.coverUrl }),
      ...(dto.defaultCanvasWidth !== undefined && {
        defaultCanvasWidth: dto.defaultCanvasWidth,
      }),
      ...(dto.defaultCanvasHeight !== undefined && {
        defaultCanvasHeight: dto.defaultCanvasHeight,
      }),
      ...(dto.defaultBleedPx !== undefined && {
        defaultBleedPx: dto.defaultBleedPx,
      }),
      ...(dto.defaultSides !== undefined && { defaultSides: dto.defaultSides }),
      ...(dto.printSpec !== undefined && { printSpec: dto.printSpec }),
      ...(dto.productCategorySlug !== undefined && {
        productCategorySlug: dto.productCategorySlug || null,
      }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const row = await this.findById(id);
    await this.repo.remove(row);
    return { id, deleted: true };
  }

  /**
   * Idempotently insert the canonical bootstrap categories. Existing
   * rows (matched by slug) are left alone — admins can rename / resize
   * defaults without us clobbering their changes on the next boot.
   */
  async ensureDefaults(): Promise<void> {
    for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
      const seed = DEFAULT_CATEGORIES[i];
      const existing = await this.repo.findOneBy({ slug: seed.slug });
      if (existing) continue;
      await this.repo.save(
        this.repo.create({
          ...seed,
          description: seed.description ?? null,
          iconUrl: null,
          coverUrl: null,
          defaultBleedPx: seed.defaultBleedPx ?? 0,
          defaultSides: seed.defaultSides ?? [{ id: 'front', label: 'Front' }],
          printSpec: {},
          sortOrder: i,
          isActive: true,
        }),
      );
    }
  }

  /**
   * VistaPrint-parity sync: ensure every canonical {@link
   * ProductCategory} has a matching `TemplateCategory` so admins can
   * author templates for visiting cards / labels / stickers /
   * packaging / drinkware / etc. and customers see them in the
   * storefront templates rail.
   *
   * Strategy
   * ────────
   * For each preset in {@link PRODUCT_CATEGORY_TEMPLATE_PRESETS}:
   *   1. If a row already exists by `productCategorySlug` link →
   *      leave it alone (admin may have renamed / resized it).
   *   2. Otherwise look for a row whose `slug` matches the preset's
   *      kebab-case slug. If found, **backfill** the link (one-time)
   *      so the studio's product-binder can match it, but don't
   *      touch any other fields.
   *   3. If neither exists, create a fresh row with the preset's
   *      canvas defaults + the back-link.
   *
   * The two-tier check protects:
   *   - older deploys that have a manually-created `apparel` /
   *     `stationery` row without the link column populated,
   *   - the seeded `business-card` row (the customer-facing
   *     "Business Cards" design-kind) which we deliberately don't
   *     collide with `visiting-cards` (the product-bound row).
   *
   * Idempotent — safe to call on every boot.
   */
  async syncFromProductCategories(): Promise<void> {
    const presets = PRODUCT_CATEGORY_TEMPLATE_PRESETS;
    // The product canonical list is short (~14 entries); we run
    // sequentially to keep boot-time logs deterministic and avoid
    // racing on the unique slug index.
    for (let i = 0; i < presets.length; i++) {
      const preset = presets[i];

      const linked = await this.repo.findOneBy({
        productCategorySlug: preset.productCategorySlug,
      });
      if (linked) continue;

      const sameSlug = await this.repo.findOneBy({ slug: preset.slug });
      if (sameSlug) {
        if (!sameSlug.productCategorySlug) {
          sameSlug.productCategorySlug = preset.productCategorySlug;
          await this.repo.save(sameSlug);
        }
        continue;
      }

      await this.repo.save(
        this.repo.create({
          slug: preset.slug,
          name: preset.name,
          description: preset.description,
          iconUrl: null,
          coverUrl: null,
          defaultCanvasWidth: preset.defaultCanvasWidth,
          defaultCanvasHeight: preset.defaultCanvasHeight,
          defaultBleedPx: preset.defaultBleedPx,
          defaultSides: preset.defaultSides,
          printSpec: {},
          productCategorySlug: preset.productCategorySlug,
          // Push synced rows after the hand-curated design kinds
          // (flyer/banner/brochure/poster/social = sortOrder 0-7) so
          // the admin sees curated kinds first, then merchandise
          // categories.
          sortOrder: 100 + i,
          isActive: true,
        }),
      );
    }
  }
}
