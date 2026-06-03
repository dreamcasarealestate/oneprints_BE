import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignTemplate } from './template.entity';
import { TemplateCategory } from './template-category.entity';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { TemplateCategoriesService } from './template-categories.service';
import { TemplateCategoriesController } from './template-categories.controller';
import { TemplateSchemaBootstrapService } from './template-schema-bootstrap.service';
import { Product } from '../catalogue/product.entity';

@Module({
  // We pull the Product repo into this module (without owning it)
  // so the templates service can batch-fetch `basePrice` for
  // bound templates without going through the catalogue service —
  // keeps the "From ₹X" pill resolved server-side without an N+1
  // and without a circular dependency on CatalogueModule.
  imports: [TypeOrmModule.forFeature([DesignTemplate, TemplateCategory, Product])],
  // `TemplateSchemaBootstrapService` runs in `onModuleInit` to
  // add columns we shipped after the table was first created
  // (sides, customSections, priceFromOverride, width/height).
  // Idempotent + safe to re-run on every boot — fixes the
  // `column "sides" does not exist` crash on environments where
  // TypeORM's `synchronize: true` didn't catch up (Neon /
  // Supabase pooled connections occasionally drop multi-clause
  // ALTER TABLEs silently).
  providers: [
    TemplatesService,
    TemplateCategoriesService,
    TemplateSchemaBootstrapService,
  ],
  controllers: [TemplatesController, TemplateCategoriesController],
  exports: [TemplatesService, TemplateCategoriesService],
})
export class TemplatesModule {}
