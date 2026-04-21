import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductTemplate } from './product-template.entity';
import { ProductTemplatesController } from './product-templates.controller';
import { ProductTemplatesService } from './product-templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductTemplate])],
  controllers: [ProductTemplatesController],
  providers: [ProductTemplatesService],
  exports: [ProductTemplatesService],
})
export class ProductTemplatesModule {}
