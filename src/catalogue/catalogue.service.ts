import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { Product } from './product.entity';
import { ProductBranchPricing } from './product-branch-pricing.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export type ProductListQuery = {
  categorySlug?: string;
  search?: string;
  branchId?: string;
};

@Injectable()
export class CatalogueService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly catRepo: Repository<ProductCategory>,
    @InjectRepository(Product)
    private readonly prodRepo: Repository<Product>,
    @InjectRepository(ProductBranchPricing)
    private readonly branchPriceRepo: Repository<ProductBranchPricing>,
  ) {}

  async listCategories(branchId?: string) {
    if (!branchId?.trim()) {
      return this.catRepo.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
    }

    const branchFilter = JSON.stringify([branchId.trim()]);
    return this.catRepo
      .createQueryBuilder('c')
      .distinct(true)
      .innerJoin(Product, 'p', 'p.categoryId = c.id')
      .where('p.isActive = :active', { active: true })
      .andWhere(
        '(p.branchAvailability IS NULL OR p.branchAvailability @> CAST(:branchFilter AS jsonb))',
        { branchFilter },
      )
      .orderBy('c.sortOrder', 'ASC')
      .addOrderBy('c.name', 'ASC')
      .getMany();
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
    const defaults: { name: string; slug: string; sortOrder: number }[] = [
      { name: 'Apparel', slug: 'apparel', sortOrder: 10 },
      { name: 'Drinkware', slug: 'drinkware', sortOrder: 20 },
      { name: 'Bags', slug: 'bags', sortOrder: 30 },
      { name: 'Stationery', slug: 'stationery', sortOrder: 40 },
      { name: 'Office', slug: 'office', sortOrder: 50 },
      { name: 'Awards', slug: 'awards', sortOrder: 60 },
      { name: 'Promo & events', slug: 'promo', sortOrder: 70 },
      { name: 'Tech accessories', slug: 'tech_accessories', sortOrder: 80 },
      { name: 'Corporate gifting', slug: 'corporate_gifting', sortOrder: 90 },
    ];
    for (const row of defaults) {
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

    if (q.branchId?.trim()) {
      qb.andWhere(
        '(p.branchAvailability IS NULL OR p.branchAvailability @> CAST(:branchFilter AS jsonb))',
        { branchFilter: JSON.stringify([q.branchId.trim()]) },
      );
    }

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
    return qb.getMany();
  }

  async getProduct(id: string) {
    const p = await this.prodRepo.findOne({
      where: { id, isActive: true },
      relations: ['category'],
    });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }

  createProduct(dto: CreateProductDto) {
    const p = this.prodRepo.create({
      sku: dto.sku.trim(),
      name: dto.name.trim(),
      categoryId: dto.categoryId,
      description: dto.description?.trim() ?? null,
      basePrice: dto.basePrice,
      bulkTiers: dto.bulkTiers ?? [],
      images: dto.images ?? [],
      printAreas: (dto.printAreas as Product['printAreas']) ?? [],
      availableColours: dto.availableColours ?? [],
      availableSizes: dto.availableSizes ?? [],
      minOrderQty: dto.minOrderQty ?? 1,
      productionTimeDays: dto.productionTimeDays ?? 5,
      supportsEditor: dto.supportsEditor ?? true,
      supportsCustomMeasurement: dto.supportsCustomMeasurement ?? false,
      supportsDesignerMarketplace: dto.supportsDesignerMarketplace ?? true,
      gstRate: dto.gstRate ?? 18,
      isActive: dto.isActive ?? true,
      branchAvailability: dto.branchAvailability ?? null,
    });
    return this.prodRepo.save(p);
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
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
    if (dto.printAreas !== undefined)
      p.printAreas = dto.printAreas as Product['printAreas'];
    if (dto.availableColours !== undefined)
      p.availableColours = dto.availableColours;
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
    if (dto.branchAvailability !== undefined)
      p.branchAvailability = dto.branchAvailability ?? null;
    return this.prodRepo.save(p);
  }

  async archiveProduct(id: string) {
    const p = await this.prodRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Product not found');
    p.isActive = false;
    return this.prodRepo.save(p);
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
            branchAvailability: null,
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

  listBranchPricing(productId: string) {
    return this.branchPriceRepo.find({
      where: { productId },
      relations: ['branch'],
      order: { createdAt: 'ASC' },
    });
  }

  async upsertBranchPricing(
    productId: string,
    branchId: string,
    priceOverride: number,
  ) {
    await this.requireProductRow(productId);
    let row = await this.branchPriceRepo.findOne({
      where: { productId, branchId },
    });
    if (!row) {
      row = this.branchPriceRepo.create({
        productId,
        branchId,
        priceOverride,
      });
    } else {
      row.priceOverride = priceOverride;
    }
    return this.branchPriceRepo.save(row);
  }

  async deleteBranchPricing(productId: string, branchId: string) {
    await this.branchPriceRepo.delete({ productId, branchId });
    return { deleted: true };
  }
}
