import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designer } from './designer.entity';
import { DesignerJob } from './designer-job.entity';
import { DesignerMessage } from './designer-message.entity';
import { DesignerProof } from './designer-proof.entity';
import { ApplyDesignerDto } from './dto/apply-designer.dto';
import { UpdateDesignerProfileDto } from './dto/update-designer-profile.dto';
import { CreateDesignerJobDto } from './dto/create-designer-job.dto';
import { RejectDesignerDto } from './dto/reject-designer.dto';
import { DesignerProofDto } from './dto/designer-proof.dto';
import { DesignerMessageDto } from './dto/designer-message.dto';
import { User } from '../user/user.entity';
import { NotificationsService } from '../notification/notifications.service';

@Injectable()
export class DesignersService {
  constructor(
    @InjectRepository(Designer)
    private readonly designerRepo: Repository<Designer>,
    @InjectRepository(DesignerJob)
    private readonly jobRepo: Repository<DesignerJob>,
    @InjectRepository(DesignerMessage)
    private readonly msgRepo: Repository<DesignerMessage>,
    @InjectRepository(DesignerProof)
    private readonly proofRepo: Repository<DesignerProof>,
    private readonly notifications: NotificationsService,
  ) {}

  apply(dto: ApplyDesignerDto) {
    const d = this.designerRepo.create({
      displayName: dto.displayName.trim(),
      email: dto.email.trim().toLowerCase(),
      city: dto.city?.trim() ?? null,
      bio: dto.bio?.trim() ?? null,
      specializations: dto.specializations ?? [],
      portfolioUrls: dto.portfolioUrls ?? [],
      baseRateInr: dto.baseRateInr ?? 0,
      rateType: dto.rateType ?? 'project',
      yearsExperience: dto.yearsExperience ?? 0,
      status: 'pending',
      verified: false,
      availability: 'available',
    });
    return this.designerRepo.save(d);
  }

  listApproved(search?: string, specialization?: string) {
    const qb = this.designerRepo
      .createQueryBuilder('d')
      .where('d.status = :st', { st: 'approved' });
    if (search?.trim()) {
      qb.andWhere(
        '(LOWER(d.displayName) LIKE :q OR LOWER(d.bio) LIKE :q)',
        { q: `%${search.trim().toLowerCase()}%` },
      );
    }
    if (specialization?.trim()) {
      qb.andWhere(`d.specializations::text ILIKE :sp`, {
        sp: `%${specialization.trim()}%`,
      });
    }
    qb.orderBy('d.displayName', 'ASC');
    return qb.getMany();
  }

  getPublic(id: string) {
    return this.designerRepo.findOne({
      where: { id, status: 'approved' },
    });
  }

  listPending() {
    return this.designerRepo.find({
      where: { status: 'pending' },
      order: { createdAt: 'ASC' },
    });
  }

  async approveDesigner(id: string) {
    const d = await this.designerRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Designer not found');
    d.status = 'approved';
    d.rejectionReason = null;
    return this.designerRepo.save(d);
  }

  async rejectDesigner(id: string, dto: RejectDesignerDto) {
    const d = await this.designerRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Designer not found');
    d.status = 'rejected';
    d.rejectionReason = dto.reason.trim();
    return this.designerRepo.save(d);
  }

  async updateOwnProfile(user: User, designerId: string, dto: UpdateDesignerProfileDto) {
    const d = await this.designerRepo.findOne({ where: { id: designerId } });
    if (!d) throw new NotFoundException('Designer not found');
    if (d.userId !== user.id) throw new ForbiddenException();
    if (dto.displayName !== undefined) d.displayName = dto.displayName.trim();
    if (dto.bio !== undefined) d.bio = dto.bio?.trim() ?? null;
    if (dto.specializations !== undefined) d.specializations = dto.specializations;
    if (dto.portfolioUrls !== undefined) d.portfolioUrls = dto.portfolioUrls;
    if (dto.baseRateInr !== undefined) d.baseRateInr = dto.baseRateInr;
    if (dto.rateType !== undefined) d.rateType = dto.rateType;
    if (dto.availability !== undefined) d.availability = dto.availability;
    if (dto.turnaroundText !== undefined)
      d.turnaroundText = dto.turnaroundText?.trim() ?? null;
    return this.designerRepo.save(d);
  }

  private async designerForUser(userId: string) {
    return this.designerRepo.findOne({
      where: { userId, status: 'approved' },
    });
  }

  async createJob(customerId: string, dto: CreateDesignerJobDto) {
    const designer = await this.designerRepo.findOne({
      where: { id: dto.designerId, status: 'approved' },
    });
    if (!designer) throw new NotFoundException('Designer not available');

    const job = this.jobRepo.create({
      customerUserId: customerId,
      designerId: dto.designerId,
      productId: dto.productId ?? null,
      orderItemId: dto.orderItemId ?? null,
      title: dto.title?.trim() || 'Design request',
      brief: dto.brief.trim(),
      budgetInr: dto.budgetInr ?? null,
      deadlineText: dto.deadlineText?.trim() ?? null,
      referenceAssetUrls: dto.referenceAssetUrls ?? [],
      designDraftJson: dto.designDraftJson ?? null,
      status: 'requested',
    });
    const saved = await this.jobRepo.save(job);

    if (designer.userId) {
      await this.notifications.create(
        designer.userId,
        'designer_job',
        'New design request',
        `A customer requested a design: ${saved.title}`,
        { jobId: saved.id },
      );
    }
    return saved;
  }

  async acceptJob(jobId: string, userId: string) {
    const designer = await this.designerForUser(userId);
    if (!designer) throw new ForbiddenException('Not a linked designer account');
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.designerId !== designer.id) throw new ForbiddenException();
    if (job.status !== 'requested') {
      throw new BadRequestException('Job is not open for acceptance');
    }
    job.status = 'accepted';
    await this.jobRepo.save(job);
    await this.notifications.create(
      job.customerUserId,
      'designer_job',
      'Designer accepted your request',
      `Your design job was accepted.`,
      { jobId },
    );
    return job;
  }

  async declineJob(jobId: string, userId: string) {
    const designer = await this.designerForUser(userId);
    if (!designer) throw new ForbiddenException();
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.designerId !== designer.id) throw new ForbiddenException();
    job.status = 'declined';
    await this.jobRepo.save(job);
    await this.notifications.create(
      job.customerUserId,
      'designer_job',
      'Designer declined',
      `Your design request was declined.`,
      { jobId },
    );
    return job;
  }

  async addProof(jobId: string, userId: string, dto: DesignerProofDto) {
    const designer = await this.designerForUser(userId);
    if (!designer) throw new ForbiddenException();
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.designerId !== designer.id) throw new ForbiddenException();
    const proof = this.proofRepo.create({
      jobId,
      fileUrl: dto.fileUrl.trim(),
      revisionRound: dto.revisionRound ?? 1,
    });
    await this.proofRepo.save(proof);
    job.status = 'in_progress';
    await this.jobRepo.save(job);
    await this.notifications.create(
      job.customerUserId,
      'designer_job',
      'New design proof',
      'Your designer uploaded a proof.',
      { jobId },
    );
    return proof;
  }

  async approveJob(jobId: string, customerId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.customerUserId !== customerId) throw new ForbiddenException();
    job.status = 'completed';
    await this.jobRepo.save(job);
    return job;
  }

  listMessages(jobId: string, userId: string) {
    return this.assertJobParticipant(jobId, userId).then(() =>
      this.msgRepo.find({
        where: { jobId },
        order: { createdAt: 'ASC' },
        relations: ['sender'],
      }),
    );
  }

  async postMessage(jobId: string, userId: string, dto: DesignerMessageDto) {
    await this.assertJobParticipant(jobId, userId);
    const msg = this.msgRepo.create({
      jobId,
      senderId: userId,
      body: dto.body.trim(),
    });
    const saved = await this.msgRepo.save(msg);
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (job) {
      const designer = await this.designerRepo.findOne({
        where: { id: job.designerId },
      });
      if (userId === job.customerUserId && designer?.userId) {
        await this.notifications.create(
          designer.userId,
          'designer_message',
          'New message on design job',
          dto.body.slice(0, 120),
          { jobId },
        );
      } else if (designer?.userId === userId) {
        await this.notifications.create(
          job.customerUserId,
          'designer_message',
          'New message on design job',
          dto.body.slice(0, 120),
          { jobId },
        );
      }
    }
    return saved;
  }

  private async assertJobParticipant(jobId: string, userId: string) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    const designer = await this.designerRepo.findOne({
      where: { id: job.designerId },
    });
    const isCustomer = job.customerUserId === userId;
    const isDesigner = designer?.userId === userId;
    if (!isCustomer && !isDesigner) throw new ForbiddenException();
    return job;
  }
}
