import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductTemplate } from './product-template.entity';
import {
  CreateProductTemplateDto,
  UpdateProductTemplateDto,
} from './dto/product-template.dto';
import { User } from '../user/user.entity';

function normalizeProductType(value?: string | null) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export type ProductTemplateResponse = {
  id: string;
  productType: string;
  name: string;
  description: string | null;
  skeleton: Record<string, any>;
  createdByUserId: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toResponse(tpl: ProductTemplate): ProductTemplateResponse {
  const creator = tpl.user ?? null;
  const firstName = creator?.firstName?.trim() ?? '';
  const lastName = creator?.lastName?.trim() ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return {
    id: tpl.id,
    productType: tpl.productType,
    name: tpl.name,
    description: tpl.description ?? null,
    skeleton: tpl.skeleton ?? {},
    createdByUserId: tpl.userId,
    createdByName: fullName || creator?.email || null,
    createdAt: tpl.createdAt,
    updatedAt: tpl.updatedAt,
  };
}

@Injectable()
export class ProductTemplatesService {
  constructor(
    @InjectRepository(ProductTemplate)
    private readonly repo: Repository<ProductTemplate>,
  ) {}

  async create(userId: string, dto: CreateProductTemplateDto) {
    const productType = normalizeProductType(dto.productType);
    const name = dto.name?.trim() ?? '';
    if (!productType) throw new BadRequestException('productType is required');
    if (!name) throw new BadRequestException('name is required');
    if (!dto.skeleton || typeof dto.skeleton !== 'object') {
      throw new BadRequestException('skeleton must be an object');
    }

    const tpl = this.repo.create({
      userId,
      productType,
      name,
      description: dto.description?.trim() || null,
      skeleton: dto.skeleton,
    });
    const saved = await this.repo.save(tpl);
    const withUser = await this.repo.findOne({
      where: { id: saved.id },
      relations: { user: true },
    });
    return toResponse(withUser ?? saved);
  }

  async findAllByUser(_userId: string, productType?: string) {
    const filterType = normalizeProductType(productType);
    const rows = await this.repo.find({
      where: filterType ? { productType: filterType } : {},
      order: { updatedAt: 'DESC' },
      relations: { user: true },
    });
    return rows.map(toResponse);
  }

  async findOne(id: string, _userId: string) {
    const tpl = await this.repo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    return toResponse(tpl);
  }

  async update(id: string, userId: string, dto: UpdateProductTemplateDto) {
    const tpl = await this.repo.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException('Template not found');
    if (tpl.userId !== userId) {
      throw new ForbiddenException('You can only edit your own templates');
    }
    if (dto.name !== undefined) {
      const nm = dto.name.trim();
      if (!nm) throw new BadRequestException('name cannot be empty');
      tpl.name = nm;
    }
    if (dto.description !== undefined) {
      tpl.description = dto.description?.trim() || null;
    }
    if (dto.skeleton !== undefined) {
      if (typeof dto.skeleton !== 'object') {
        throw new BadRequestException('skeleton must be an object');
      }
      tpl.skeleton = dto.skeleton;
    }
    await this.repo.save(tpl);
    const withUser = await this.repo.findOne({
      where: { id: tpl.id },
      relations: { user: true },
    });
    return toResponse(withUser ?? tpl);
  }

  async remove(id: string, userId: string) {
    const tpl = await this.repo.findOne({ where: { id } });
    if (!tpl) throw new NotFoundException('Template not found');
    if (tpl.userId !== userId) {
      throw new ForbiddenException('You can only delete your own templates');
    }
    await this.repo.remove(tpl);
    return { id };
  }
}
