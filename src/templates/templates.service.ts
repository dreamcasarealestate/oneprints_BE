import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { DesignTemplate } from './template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(DesignTemplate)
    private readonly repo: Repository<DesignTemplate>,
  ) {}

  list(opts: { categorySlug?: string; search?: string; limit?: number; offset?: number }) {
    const where: Record<string, unknown> = { isPublic: true };
    if (opts.categorySlug) where.categorySlug = opts.categorySlug;
    if (opts.search) where.title = ILike(`%${opts.search}%`);
    return this.repo.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'DESC' },
      take: opts.limit ?? 48,
      skip: opts.offset ?? 0,
      select: ['id', 'title', 'categorySlug', 'tags', 'thumbnailUrl', 'isPublic', 'sortOrder', 'usageCount', 'createdAt', 'updatedAt'],
    });
  }

  listAll() {
    return this.repo.find({ order: { sortOrder: 'ASC', createdAt: 'DESC' } });
  }

  async getOne(id: string): Promise<DesignTemplate> {
    const tpl = await this.repo.findOneBy({ id });
    if (!tpl) throw new NotFoundException('Template not found');
    await this.repo.increment({ id }, 'usageCount', 1);
    return tpl;
  }

  create(dto: CreateTemplateDto): Promise<DesignTemplate> {
    const tpl = this.repo.create({
      title: dto.title,
      categorySlug: dto.categorySlug ?? null,
      tags: dto.tags ?? [],
      thumbnailUrl: dto.thumbnailUrl ?? null,
      canvasState: dto.canvasState,
      isPublic: dto.isPublic ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.repo.save(tpl);
  }

  async update(id: string, dto: Partial<CreateTemplateDto>): Promise<DesignTemplate> {
    const tpl = await this.repo.findOneBy({ id });
    if (!tpl) throw new NotFoundException('Template not found');
    Object.assign(tpl, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.categorySlug !== undefined && { categorySlug: dto.categorySlug }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.thumbnailUrl !== undefined && { thumbnailUrl: dto.thumbnailUrl }),
      ...(dto.canvasState !== undefined && { canvasState: dto.canvasState }),
      ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
    });
    return this.repo.save(tpl);
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const tpl = await this.repo.findOneBy({ id });
    if (!tpl) throw new NotFoundException('Template not found');
    await this.repo.remove(tpl);
    return { id, deleted: true };
  }
}
