import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductCategory } from './product-category.entity';
import { Product } from './product.entity';
import { ProductBranchPricing } from './product-branch-pricing.entity';
import { CatalogueService } from './catalogue.service';
import { CategoriesController } from './categories.controller';
import { ProductsController } from './products.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductCategory, Product, ProductBranchPricing]),
  ],
  controllers: [CategoriesController, ProductsController],
  providers: [CatalogueService],
  exports: [CatalogueService, TypeOrmModule],
})
export class CatalogueModule {}
