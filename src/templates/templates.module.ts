import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignTemplate } from './template.entity';
import { TemplateCategory } from './template-category.entity';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { TemplateCategoriesService } from './template-categories.service';
import { TemplateCategoriesController } from './template-categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DesignTemplate, TemplateCategory])],
  providers: [TemplatesService, TemplateCategoriesService],
  controllers: [TemplatesController, TemplateCategoriesController],
  exports: [TemplatesService, TemplateCategoriesService],
})
export class TemplatesModule {}
