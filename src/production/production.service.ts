import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionJob, ProductionStatus } from './production-job.entity';

export class CreateProductionJobDto {
  orderId: string;
  orderItemId?: string;
  branchId?: string;
  productName?: string;
  quantity?: number;
  notes?: string;
  printFileUrl?: string;
}

export class UpdateProductionJobDto {
  status?: ProductionStatus;
  assignedOperatorId?: string | null;
  notes?: string;
  printFileUrl?: string;
}

@Injectable()
export class ProductionService {
  constructor(
    @InjectRepository(ProductionJob)
    private readonly repo: Repository<ProductionJob>,
  ) {}

  private async nextJobNumber(): Promise<string> {
    const count = await this.repo.count();
    return `JOB-${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateProductionJobDto): Promise<ProductionJob> {
    const jobNumber = await this.nextJobNumber();
    const job = this.repo.create({
      orderId: dto.orderId,
      orderItemId: dto.orderItemId ?? null,
      branchId: dto.branchId ?? null,
      jobNumber,
      status: 'queued',
      productName: dto.productName ?? null,
      quantity: dto.quantity ?? 1,
      notes: dto.notes ?? null,
      printFileUrl: dto.printFileUrl ?? null,
    });
    return this.repo.save(job);
  }

  list(opts: { branchId?: string; status?: ProductionStatus; orderId?: string }) {
    const qb = this.repo.createQueryBuilder('job')
      .leftJoinAndSelect('job.assignedOperator', 'op')
      .orderBy('job.createdAt', 'ASC');
    if (opts.branchId) qb.andWhere('job.branchId = :branchId', { branchId: opts.branchId });
    if (opts.status) qb.andWhere('job.status = :status', { status: opts.status });
    if (opts.orderId) qb.andWhere('job.orderId = :orderId', { orderId: opts.orderId });
    return qb.getMany();
  }

  async getOne(id: string): Promise<ProductionJob> {
    const job = await this.repo.findOne({ where: { id }, relations: ['assignedOperator'] });
    if (!job) throw new NotFoundException('Production job not found');
    return job;
  }

  async update(id: string, dto: UpdateProductionJobDto): Promise<ProductionJob> {
    const job = await this.getOne(id);
    if (dto.status !== undefined) {
      job.status = dto.status;
      if (dto.status === 'printing' && !job.startedAt) job.startedAt = new Date();
      if (dto.status === 'done' && !job.completedAt) job.completedAt = new Date();
    }
    if (dto.assignedOperatorId !== undefined) job.assignedOperatorId = dto.assignedOperatorId;
    if (dto.notes !== undefined) job.notes = dto.notes;
    if (dto.printFileUrl !== undefined) job.printFileUrl = dto.printFileUrl;
    return this.repo.save(job);
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const job = await this.getOne(id);
    await this.repo.remove(job);
    return { id, deleted: true };
  }

  async stats(branchId?: string) {
    const qb = this.repo.createQueryBuilder('job');
    if (branchId) qb.where('job.branchId = :branchId', { branchId });
    const rows = await qb.select('job.status', 'status').addSelect('COUNT(*)', 'count').groupBy('job.status').getRawMany<{ status: string; count: string }>();
    return rows.reduce<Record<string, number>>((acc, r) => { acc[r.status] = parseInt(r.count, 10); return acc; }, {});
  }
}
