import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Design } from './design.entity';
import { UpsertDesignDto } from './dto/upsert-design.dto';

@Injectable()
export class DesignsService {
  constructor(
    @InjectRepository(Design)
    private readonly repo: Repository<Design>,
  ) {}

  async upsert(userId: string, dto: UpsertDesignDto) {
    if (dto.id) {
      const existing = await this.repo.findOne({
        where: { id: dto.id, userId },
      });
      if (!existing) throw new NotFoundException('Design not found');
      existing.title = dto.title ?? existing.title;
      existing.productId = dto.productId ?? existing.productId;
      existing.canvasState = dto.canvasState;
      existing.previewUrl = dto.previewUrl ?? existing.previewUrl;
      return this.repo.save(existing);
    }
    const d = this.repo.create({
      userId,
      title: dto.title ?? null,
      productId: dto.productId ?? null,
      canvasState: dto.canvasState,
      previewUrl: dto.previewUrl ?? null,
    });
    return this.repo.save(d);
  }

  listMine(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async getOne(userId: string, id: string) {
    const d = await this.repo.findOne({ where: { id, userId } });
    if (!d) throw new NotFoundException('Design not found');
    return d;
  }

  async remove(userId: string, id: string) {
    const d = await this.repo.findOne({ where: { id, userId } });
    if (!d) throw new NotFoundException('Design not found');
    await this.repo.remove(d);
    return { id, deleted: true };
  }

  exportPdfStub(id: string, userId: string) {
    return this.getOne(userId, id).then(() => ({
      jobId: `pdf-job-${id.slice(0, 8)}`,
      message: 'Queued for server-side PDF render (integrate Puppeteer + S3).',
    }));
  }

  removeBackgroundStub() {
    return {
      message: 'Connect to AI background removal provider; stub response.',
      processedUrl: null as string | null,
    };
  }
}
