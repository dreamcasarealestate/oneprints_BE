import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductCategory } from './product-category.entity';
import { Product } from './product.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';

export type ProductListQuery = {
  categorySlug?: string;
  search?: string;
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
}
