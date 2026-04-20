import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Design } from '../design/design.entity';
import { DesignerJob } from '../designer/designer-job.entity';
import { ProductCategory } from './product-category.entity';
import { Product } from './product.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CANONICAL_CATEGORIES } from './canonical-categories';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { User } from '../user/user.entity';

export type ProductListQuery = {
  categorySlug?: string;
  search?: string;
  limit?: number;
};

function normalizeImagesByColour(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).trim();
    if (!key) continue;
    if (typeof v === 'string' && v.trim().length > 0) {
      out[key] = [v.trim()];
    } else if (Array.isArray(v)) {
      const urls = v
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim());
      if (urls.length) out[key] = urls;
    }
  }
  return out;
}

function hexKey(c: string): string | null {
  const t = c.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return t.toLowerCase();
  return null;
}

function pruneImagesByColour(
  map: Record<string, string[]>,
  colours: string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const allowed = colours.map((c) => c.trim()).filter(Boolean);
  for (const colour of allowed) {
    let urls = map[colour];
    if (!urls?.length) {
      const nh = hexKey(colour);
      if (nh) {
        const hit = Object.entries(map).find(
          ([k]) => hexKey(k) === nh || k.trim().toLowerCase() === nh,
        );
        urls = hit?.[1];
      }
    }
    if (urls?.length) out[colour] = [...urls];
  }
  return out;
}

function displayNameForActor(user: User): string {
  const u = user as User & {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  const parts = [u.firstName, u.lastName].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0,
  );
  const joined = parts.join(' ').trim();
  if (joined) return joined.slice(0, 200);
  if (u.email?.trim()) return u.email.trim().slice(0, 200);
  return u.id.slice(0, 8);
}

export type AdminProductListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  /** When empty or omitted, all categories. */
  categorySlugs?: string[];
  status?: 'all' | 'active' | 'archived';
};

@Injectable()
export class CatalogueService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly catRepo: Repository<ProductCategory>,
    @InjectRepository(Product)
    private readonly prodRepo: Repository<Product>,
  ) {}

  listCategories() {
    return this.catRepo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  createCategory(dto: CreateCategoryDto) {
    const c = this.catRepo.create({
      name: dto.name.trim(),
      slug: dto.slug.trim().toLowerCase(),
      parentId: dto.parentId ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.catRepo.save(c);
  }

  /** Idempotent seed for storefront navigation — safe to call on every boot. */
  async ensureDefaultCategories() {
    for (const row of CANONICAL_CATEGORIES) {
      const existing = await this.catRepo.findOne({
        where: { slug: row.slug },
      });
      if (!existing) {
        await this.catRepo.save(
          this.catRepo.create({
            name: row.name,
            slug: row.slug,
            parentId: null,
            sortOrder: row.sortOrder,
          }),
        );
      }
    }
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const c = await this.catRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
    if (dto.name !== undefined) c.name = dto.name.trim();
    if (dto.slug !== undefined) c.slug = dto.slug.trim().toLowerCase();
    if (dto.parentId !== undefined) c.parentId = dto.parentId;
    if (dto.sortOrder !== undefined) c.sortOrder = dto.sortOrder;
    return this.catRepo.save(c);
  }

  async listProducts(q: ProductListQuery) {
    const qb = this.prodRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'c')
      .where('p.isActive = :active', { active: true });

    if (q.categorySlug) {
      qb.andWhere('c.slug = :slug', { slug: q.categorySlug });
    }
    if (q.search?.trim()) {
      qb.andWhere(
        '(LOWER(p.name) LIKE :s OR LOWER(p.sku) LIKE :s OR LOWER(p.description) LIKE :s)',
        { s: `%${q.search.trim().toLowerCase()}%` },
      );
    }
    qb.orderBy('p.name', 'ASC');
    if (q.limit && q.limit > 0) {
      qb.take(Math.min(q.limit, 200));
    }
    return qb.getMany();
  }

  /**
   * Admin catalogue — paginated search, optional category + active/archived filter.
   */
  async listProductsAdminPaged(q: AdminProductListQuery) {
    const page = Math.max(1, Math.floor(Number(q.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(q.limit) || 20)));
    const status = q.status ?? 'all';

    const applyFilters = (qb: SelectQueryBuilder<Product>) => {
      if (status === 'active') {
        qb.andWhere('p.isActive = :ia', { ia: true });
      } else if (status === 'archived') {
        qb.andWhere('p.isActive = :ia', { ia: false });
      }
      const slugs = (q.categorySlugs ?? [])
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (slugs.length === 1) {
        qb.andWhere('c.slug = :slug', { slug: slugs[0] });
      } else if (slugs.length > 1) {
        qb.andWhere('c.slug IN (:...slugs)', { slugs });
      }
      if (q.search?.trim()) {
        const s = `%${q.search.trim().toLowerCase()}%`;
        qb.andWhere(
          '(LOWER(p.name) LIKE :s OR LOWER(p.sku) LIKE :s OR LOWER(COALESCE(p.description, \'\')) LIKE :s OR LOWER(c.name) LIKE :s OR LOWER(c.slug) LIKE :s OR LOWER(COALESCE(p.createdByDisplayName, \'\')) LIKE :s)',
          { s },
        );
      }
    };

    const countQb = this.prodRepo
      .createQueryBuilder('p')
      .leftJoin('p.category', 'c');
    applyFilters(countQb);
    const total = await countQb.getCount();

    const listQb = this.prodRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'c');
    applyFilters(listQb);
    listQb.orderBy('p.updatedAt', 'DESC');
    listQb.skip((page - 1) * limit).take(limit);
    const items = await listQb.getMany();

    return { items, total, page, limit };
  }

  async getProduct(id: string) {
    const p = await this.prodRepo.findOne({
      where: { id, isActive: true },
      relations: ['category'],
    });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  async createProduct(dto: CreateProductDto, actor?: User) {
    const dn = actor ? displayNameForActor(actor) : null;
    const p = this.prodRepo.create({
      sku: dto.sku.trim(),
      name: dto.name.trim(),
      categoryId: dto.categoryId,
      description: dto.description?.trim() ?? null,
      basePrice: dto.basePrice,
      bulkTiers: dto.bulkTiers ?? [],
      images: dto.images ?? [],
      imagesByColour: normalizeImagesByColour(dto.imagesByColour ?? {}),
      customSections: dto.customSections ?? [],
      printAreas: (dto.printAreas as Product['printAreas']) ?? [],
      printSides: dto.printSides?.length ? dto.printSides : ['front'],
      blankImages: dto.blankImages ?? [],
      blankImagesByColour: dto.blankImagesByColour
        ? normalizeImagesByColour(dto.blankImagesByColour)
        : null,
      blankImagesBySideColour: dto.blankImagesBySideColour ?? null,
      imagesBySideColour: dto.imagesBySideColour ?? null,
      availableColours: dto.availableColours ?? [],
      availableSizes: dto.availableSizes ?? [],
      minOrderQty: dto.minOrderQty ?? 1,
      productionTimeDays: dto.productionTimeDays ?? 5,
      supportsEditor: dto.supportsEditor ?? true,
      supportsCustomMeasurement: dto.supportsCustomMeasurement ?? false,
      supportsDesignerMarketplace: dto.supportsDesignerMarketplace ?? true,
      gstRate: dto.gstRate ?? 18,
      isActive: dto.isActive ?? true,
      tags: dto.tags ?? [],
      trackInventory: dto.trackInventory ?? false,
      stockQuantity:
        dto.trackInventory &&
        dto.stockQuantity !== undefined &&
        dto.stockQuantity !== null
          ? Number(dto.stockQuantity)
          : null,
      restockNote: dto.restockNote?.trim() ?? null,
      branchAvailability: null,
      createdByUserId: actor?.id ?? null,
      createdByDisplayName: dn,
      updatedByUserId: actor?.id ?? null,
      updatedByDisplayName: dn,
    });
    try {
      return await this.prodRepo.save(p);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException(
          `A product with SKU "${dto.sku.trim()}" already exists.`,
        );
      }
      throw err;
    }
  }

  async updateProduct(id: string, dto: UpdateProductDto, actor?: User) {
    const p = await this.prodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    if (dto.sku !== undefined) p.sku = dto.sku.trim();
    if (dto.name !== undefined) p.name = dto.name.trim();
    if (dto.categoryId !== undefined) p.categoryId = dto.categoryId;
    if (dto.description !== undefined)
      p.description = dto.description?.trim() ?? null;
    if (dto.basePrice !== undefined) p.basePrice = dto.basePrice;
    if (dto.bulkTiers !== undefined) p.bulkTiers = dto.bulkTiers;
    if (dto.images !== undefined) p.images = dto.images;
    if (dto.customSections !== undefined) p.customSections = dto.customSections as Product['customSections'];
    if (dto.printAreas !== undefined)
      p.printAreas = dto.printAreas as Product['printAreas'];
    if (dto.availableColours !== undefined) p.availableColours = dto.availableColours;

    const colourList = dto.availableColours ?? p.availableColours;
    if (dto.imagesByColour !== undefined) {
      p.imagesByColour = pruneImagesByColour(
        normalizeImagesByColour(dto.imagesByColour),
        colourList,
      );
    } else if (dto.availableColours !== undefined) {
      p.imagesByColour = pruneImagesByColour(
        normalizeImagesByColour(p.imagesByColour ?? {}),
        colourList,
      );
    }
    if (dto.printSides !== undefined)
      p.printSides = dto.printSides?.length ? dto.printSides : ['front'];
    if (dto.blankImages !== undefined) p.blankImages = dto.blankImages;
    if (dto.blankImagesByColour !== undefined) {
      p.blankImagesByColour = dto.blankImagesByColour
        ? normalizeImagesByColour(dto.blankImagesByColour)
        : null;
    }
    if (dto.blankImagesBySideColour !== undefined)
      p.blankImagesBySideColour = dto.blankImagesBySideColour ?? null;
    if (dto.imagesBySideColour !== undefined)
      p.imagesBySideColour = dto.imagesBySideColour ?? null;
    if (dto.availableSizes !== undefined) p.availableSizes = dto.availableSizes;
    if (dto.minOrderQty !== undefined) p.minOrderQty = dto.minOrderQty;
    if (dto.productionTimeDays !== undefined)
      p.productionTimeDays = dto.productionTimeDays;
    if (dto.supportsEditor !== undefined) p.supportsEditor = dto.supportsEditor;
    if (dto.supportsCustomMeasurement !== undefined)
      p.supportsCustomMeasurement = dto.supportsCustomMeasurement;
    if (dto.supportsDesignerMarketplace !== undefined)
      p.supportsDesignerMarketplace = dto.supportsDesignerMarketplace;
    if (dto.gstRate !== undefined) p.gstRate = dto.gstRate;
    if (dto.isActive !== undefined) p.isActive = dto.isActive;
    if (dto.tags !== undefined) p.tags = dto.tags;
    if (dto.trackInventory !== undefined) {
      p.trackInventory = dto.trackInventory;
      if (!dto.trackInventory) {
        p.stockQuantity = null;
      }
    }
    if (dto.stockQuantity !== undefined)
      p.stockQuantity =
        dto.stockQuantity === null ? null : Number(dto.stockQuantity);
    if (dto.restockNote !== undefined)
      p.restockNote = dto.restockNote?.trim() ?? null;
    p.branchAvailability = null;
    if (actor) {
      p.updatedByUserId = actor.id;
      p.updatedByDisplayName = displayNameForActor(actor);
    }
    return this.prodRepo.save(p);
  }

  async archiveProduct(id: string, actor?: User) {
    const p = await this.prodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    p.isActive = false;
    if (actor) {
      p.updatedByUserId = actor.id;
      p.updatedByDisplayName = displayNameForActor(actor);
    }
    return this.prodRepo.save(p);
  }

  async restoreProduct(id: string, actor?: User) {
    const p = await this.prodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    p.isActive = true;
    if (actor) {
      p.updatedByUserId = actor.id;
      p.updatedByDisplayName = displayNameForActor(actor);
    }
    return this.prodRepo.save(p);
  }

  /**
   * Removes the product row. Order line items keep history with productId nulled (FK).
   * Branch pricing cascades. Designs and designer jobs use loose productId columns — cleared first.
   */
  async deleteProductPermanent(id: string) {
    const p = await this.prodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    await this.prodRepo.manager.transaction(async (manager) => {
      await manager.update(Design, { productId: id }, { productId: null });
      await manager.update(DesignerJob, { productId: id }, { productId: null });
      await manager.delete(Product, id);
    });
    return { deleted: true, id };
  }

  /**
   * Minimal CSV import: expects header row with sku,name,categoryId,basePrice.
   * Additional columns are ignored. Invalid rows are reported, valid rows created.
   */
  async bulkImportFromCsv(csvText: string) {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return { created: 0, errors: ['CSV must include a header and one row'] };
    }
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const errors: string[] = [];
    let created = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      try {
        const sku = cols[idx('sku')];
        const name = cols[idx('name')];
        const categoryId = cols[idx('categoryid')];
        const basePrice = Number(cols[idx('baseprice')]);
        if (!sku || !name || !categoryId || Number.isNaN(basePrice)) {
          errors.push(`Row ${i + 1}: missing sku, name, categoryId, or basePrice`);
          continue;
        }
        const cat = await this.catRepo.findOne({ where: { id: categoryId } });
        if (!cat) {
          errors.push(`Row ${i + 1}: category ${categoryId} not found`);
          continue;
        }
        await this.prodRepo.save(
          this.prodRepo.create({
            sku,
            name,
            categoryId,
            description: null,
            basePrice,
            bulkTiers: [],
            images: [],
            customSections: [],
            printAreas: [],
            availableColours: [],
            availableSizes: [],
            minOrderQty: 1,
            productionTimeDays: 5,
            supportsEditor: true,
            supportsCustomMeasurement: false,
            supportsDesignerMarketplace: true,
            gstRate: 18,
            isActive: true,
            tags: [],
            trackInventory: false,
            stockQuantity: null,
            restockNote: null,
            branchAvailability: null,
            createdByUserId: null,
            createdByDisplayName: null,
            updatedByUserId: null,
            updatedByDisplayName: null,
          }),
        );
        created += 1;
      } catch (e) {
        errors.push(
          `Row ${i + 1}: ${e instanceof Error ? e.message : 'failed'}`,
        );
      }
    }
    return { created, errors };
  }

  private async requireProductRow(id: string) {
    const p = await this.prodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

}
