import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import { UsersService } from '../user/users.service';
import { DesignerProfileStatus } from './designer.entity';
import { UserKind } from '../user/user-kind.enum';
import { isValidApparelDesignerToken } from './apparel-designer-taxonomy';

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
    private readonly usersService: UsersService,
  ) {}

  private assertApparelSpecializations(specs: string[] | undefined) {
    const list = specs ?? [];
    if (!list.length) {
      throw new BadRequestException(
        "Select at least one apparel specialization (Men's / Women's garment type).",
      );
    }
    for (const s of list) {
      if (!isValidApparelDesignerToken(String(s))) {
        throw new BadRequestException(
          `Invalid specialization "${s}". Use the official apparel categories only.`,
        );
      }
    }
  }

  async apply(dto: ApplyDesignerDto) {
    this.assertApparelSpecializations(dto.specializations);
    const email = dto.email.trim().toLowerCase();

    // If the applicant sent a password and there is no user account for this
    // email yet, provision a customer user so they can sign in once approved.
    // If a user already exists we leave credentials untouched - they will log
    // in with their existing password.
    if (dto.password && dto.password.trim()) {
      const existing = await this.usersService.findByEmail(email);
      if (!existing) {
        const fallbackName = dto.displayName.trim().split(/\s+/);
        const firstName = (dto.firstName ?? fallbackName[0] ?? 'Designer').trim();
        const lastName = (
          dto.lastName ??
          (fallbackName.length > 1 ? fallbackName.slice(1).join(' ') : 'User')
        ).trim() || 'User';
        const phoneNumber = (dto.phoneNumber ?? '').trim() || 'NA';
        await this.usersService.createManagedUser({
          firstName,
          lastName,
          email,
          password: dto.password,
          phoneNumber,
          userKind: UserKind.USER,
        });
      }
    }

    const d = this.designerRepo.create({
      displayName: dto.displayName.trim(),
      email,
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
      approvedByUserId: null,
      approvedByName: null,
      approvedAt: null,
      rejectedByUserId: null,
      rejectedByName: null,
      rejectedAt: null,
    });
    return this.designerRepo.save(d);
  }

  async listAdminDesigners(
    options: {
      search?: string;
      specialization?: string;
      rateType?: 'hourly' | 'project' | 'all';
      status?: DesignerProfileStatus | 'all';
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = Math.max(Number(options.page ?? 1) || 1, 1);
    const limit = Math.min(Math.max(Number(options.limit ?? 10) || 10, 1), 50);
    const qb = this.designerRepo
      .createQueryBuilder('d')
      .where('1=1')
      .orderBy('d.createdAt', 'DESC');

    const status = options.status?.trim();
    if (status && status !== 'all') {
      qb.where('d.status = :status', { status });
    }

    const search = options.search?.trim().toLowerCase();
    if (search) {
      qb.andWhere(
        "(LOWER(d.displayName) LIKE :q OR LOWER(d.email) LIKE :q OR LOWER(COALESCE(d.city, '')) LIKE :q OR LOWER(COALESCE(d.bio, '')) LIKE :q OR d.specializations::text ILIKE :sp)",
        {
          q: `%${search}%`,
          sp: `%${search}%`,
        },
      );
    }

    const specialization = options.specialization?.trim();
    if (specialization && specialization !== 'all') {
      qb.andWhere(`d.specializations::text ILIKE :specialization`, {
        specialization: `%${specialization}%`,
      });
    }

    const rateType = options.rateType?.trim();
    if (rateType && rateType !== 'all') {
      qb.andWhere('d.rateType = :rateType', { rateType });
    }

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total, page, limit };
  }

  listApproved(search?: string, specialization?: string) {
    const qb = this.designerRepo
      .createQueryBuilder('d')
      .where('d.status = :st', { st: 'approved' });
    if (search?.trim()) {
      qb.andWhere('(LOWER(d.displayName) LIKE :q OR LOWER(d.bio) LIKE :q)', {
        q: `%${search.trim().toLowerCase()}%`,
      });
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

  async approveDesigner(id: string, reviewer?: User) {
    const d = await this.designerRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Designer not found');
    return this.setDesignerStatusEntity(d, 'approved', reviewer);
  }

  /**
   * Linked profile (post-approval) or latest application row for the user's email.
   */
  async getOnboardingContextForUser(user: User) {
    const linked = await this.designerRepo.findOne({
      where: { userId: user.id },
    });
    if (linked) {
      return { linked: true as const, designer: linked };
    }
    const byEmail = await this.designerRepo
      .createQueryBuilder('d')
      .where('d.email = :email', { email: user.email.trim().toLowerCase() })
      .orderBy('d.createdAt', 'DESC')
      .getOne();
    return { linked: false as const, designer: byEmail ?? null };
  }

  async rejectDesigner(id: string, dto: RejectDesignerDto, reviewer?: User) {
    const d = await this.designerRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Designer not found');
    d.status = 'rejected';
    d.rejectionReason = dto.reason.trim();
    d.rejectedByUserId = reviewer?.id ?? null;
    d.rejectedByName = this.userDisplayName(reviewer) ?? null;
    d.rejectedAt = new Date();
    return this.designerRepo.save(d);
  }

  async setDesignerStatus(
    id: string,
    status: Extract<DesignerProfileStatus, 'approved' | 'suspended'>,
    reviewer?: User,
  ) {
    const d = await this.designerRepo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Designer not found');
    return this.setDesignerStatusEntity(d, status, reviewer);
  }

  private async setDesignerStatusEntity(
    designer: Designer,
    status: Extract<DesignerProfileStatus, 'approved' | 'suspended'>,
    reviewer?: User,
  ) {
    designer.status = status;
    if (status === 'approved') {
      designer.approvedByUserId = reviewer?.id ?? null;
      designer.approvedByName = this.userDisplayName(reviewer) ?? null;
      designer.approvedAt = new Date();
    }
    let saved = await this.designerRepo.save(designer);

    if (status === 'approved') {
      const user = await this.usersService.promoteCustomerToDesignerByEmail(
        saved.email,
      );
      if (user) {
        saved.userId = user.id;
        saved = await this.designerRepo.save(saved);
      }
    }

    return saved;
  }

  private userDisplayName(user?: User | null): string | null {
    if (!user) return null;
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return fullName || user.username || user.email || null;
  }

  async deleteDesigner(id: string) {
    const designer = await this.designerRepo.findOne({ where: { id } });
    if (!designer) throw new NotFoundException('Designer not found');
    if (designer.userId) {
      await this.usersService.demoteDesignerToUserById(designer.userId);
    }
    await this.designerRepo.remove(designer);
    return { id };
  }

  async updateOwnProfile(
    user: User,
    designerId: string,
    dto: UpdateDesignerProfileDto,
  ) {
    const d = await this.designerRepo.findOne({ where: { id: designerId } });
    if (!d) throw new NotFoundException('Designer not found');
    if (d.userId !== user.id) throw new ForbiddenException();
    if (dto.displayName !== undefined) d.displayName = dto.displayName.trim();
    if (dto.city !== undefined) d.city = dto.city?.trim() ?? null;
    if (dto.bio !== undefined) d.bio = dto.bio?.trim() ?? null;
    if (dto.specializations !== undefined) {
      this.assertApparelSpecializations(dto.specializations);
      d.specializations = dto.specializations;
    }
    if (dto.portfolioUrls !== undefined) d.portfolioUrls = dto.portfolioUrls;
    if (dto.baseRateInr !== undefined) d.baseRateInr = dto.baseRateInr;
    if (dto.rateType !== undefined) d.rateType = dto.rateType;
    if (dto.yearsExperience !== undefined)
      d.yearsExperience = dto.yearsExperience;
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
      const customer = await this.usersService.findById(customerId);
      const customerName =
        this.userDisplayName(customer) || 'a customer';
      await this.notifications.create(
        designer.userId,
        'designer_job',
        'New design request',
        `You got a new request from ${customerName} — “${saved.title}”.`,
        {
          jobId: saved.id,
          customerName,
          customerId: customerId,
          productId: saved.productId,
        },
      );
    }
    return saved;
  }

  async acceptJob(jobId: string, userId: string) {
    const designer = await this.designerForUser(userId);
    if (!designer)
      throw new ForbiddenException('Not a linked designer account');
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
      `${designer.displayName} accepted your request`,
      `${designer.displayName} accepted your design request — you can now start chatting.`,
      {
        jobId,
        designerId: designer.id,
        designerName: designer.displayName,
      },
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
      `${designer.displayName} declined your request`,
      `${designer.displayName} was unable to take on your design request. You can request another designer anytime.`,
      {
        jobId,
        designerId: designer.id,
        designerName: designer.displayName,
      },
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
      `${designer.displayName} shared a new proof`,
      `${designer.displayName} uploaded a new design proof for your review.`,
      {
        jobId,
        designerId: designer.id,
        designerName: designer.displayName,
      },
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

  async listMessages(jobId: string, userId: string) {
    await this.assertJobParticipant(jobId, userId);
    const messages = await this.msgRepo.find({
      where: { jobId },
      order: { createdAt: 'ASC' },
      relations: ['sender'],
    });
    const replyIds = [
      ...new Set(
        messages
          .map((m) => m.replyToMessageId)
          .filter((v): v is string => !!v),
      ),
    ];
    const replyMap = new Map<
      string,
      {
        id: string;
        body: string;
        senderId: string;
        hasAttachments: boolean;
        deletedAt: Date | null;
      }
    >();
    if (replyIds.length) {
      const replies = await this.msgRepo.find({
        where: { id: In(replyIds) },
        select: ['id', 'body', 'senderId', 'attachments', 'deletedAt'],
      });
      for (const r of replies) {
        replyMap.set(r.id, {
          id: r.id,
          body: r.body,
          senderId: r.senderId,
          hasAttachments: (r.attachments?.length ?? 0) > 0,
          deletedAt: r.deletedAt ?? null,
        });
      }
    }
    return messages.map((m) => {
      const isDeleted = !!m.deletedAt;
      const parent = m.replyToMessageId
        ? replyMap.get(m.replyToMessageId)
        : null;
      return {
        ...m,
        body: isDeleted ? '' : m.body,
        attachments: isDeleted ? [] : m.attachments,
        replyTo: parent
          ? {
              id: parent.id,
              senderId: parent.senderId,
              body: parent.deletedAt ? '' : parent.body,
              hasAttachments: parent.deletedAt ? false : parent.hasAttachments,
              deletedAt: parent.deletedAt ? parent.deletedAt : null,
            }
          : null,
      };
    });
  }

  async deleteMessage(jobId: string, userId: string, messageId: string) {
    const job = await this.assertJobParticipant(jobId, userId);
    const msg = await this.msgRepo.findOne({ where: { id: messageId, jobId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages.');
    }
    if (msg.deletedAt) return { id: msg.id, deletedAt: msg.deletedAt };
    msg.deletedAt = new Date();
    msg.body = '';
    msg.attachments = [];
    await this.msgRepo.save(msg);

    const otherUserId = await this.getOtherParticipantUserId(job, userId);
    if (otherUserId) {
      this.notifications.emitToUser(otherUserId, {
        event: 'chat_message_deleted',
        jobId,
        messageId: msg.id,
        deletedAt: msg.deletedAt.toISOString(),
      });
    }
    // Also notify the sender's other open sessions.
    this.notifications.emitToUser(userId, {
      event: 'chat_message_deleted',
      jobId,
      messageId: msg.id,
      deletedAt: msg.deletedAt.toISOString(),
    });
    return { id: msg.id, deletedAt: msg.deletedAt };
  }

  /**
   * "Delete chat" — WhatsApp-style. Hides the conversation from the requesting
   * user's inbox without affecting the other party. A new incoming message will
   * automatically clear this flag (see postMessage).
   */
  async hideConversation(jobId: string, userId: string) {
    const job = await this.assertJobParticipant(jobId, userId);
    const now = new Date();
    if (userId === job.customerUserId) {
      job.hiddenByCustomerAt = now;
    } else {
      job.hiddenByDesignerAt = now;
    }
    await this.jobRepo.save(job);
    return { id: job.id, hiddenAt: now };
  }

  /**
   * "Clear messages" — permanently removes every message in the conversation
   * for both participants. The job itself (and its metadata) is kept.
   */
  async clearConversation(jobId: string, userId: string) {
    const job = await this.assertJobParticipant(jobId, userId);
    const res = await this.msgRepo
      .createQueryBuilder()
      .delete()
      .where('jobId = :jobId', { jobId })
      .execute();

    const otherUserId = await this.getOtherParticipantUserId(job, userId);
    if (otherUserId) {
      this.notifications.emitToUser(otherUserId, {
        event: 'chat_cleared',
        jobId,
      });
    }
    this.notifications.emitToUser(userId, {
      event: 'chat_cleared',
      jobId,
    });
    return { deleted: res.affected ?? 0 };
  }

  async postMessage(jobId: string, userId: string, dto: DesignerMessageDto) {
    await this.assertJobParticipant(jobId, userId);

    const body = (dto.body ?? '').trim();
    const attachments = (dto.attachments ?? []).map((a) => ({
      url: a.url,
      name: a.name,
      mime: a.mime,
      size: a.size,
      kind: a.kind,
      isFinal: !!a.isFinal,
    }));

    if (!body && attachments.length === 0) {
      throw new BadRequestException(
        'A message must include text or at least one attachment.',
      );
    }

    let replyToMessageId: string | null = null;
    let replyPreview: {
      id: string;
      body: string;
      senderId: string;
      hasAttachments: boolean;
    } | null = null;
    if (dto.replyToMessageId) {
      const parent = await this.msgRepo.findOne({
        where: { id: dto.replyToMessageId },
      });
      if (parent && parent.jobId === jobId) {
        replyToMessageId = parent.id;
        replyPreview = {
          id: parent.id,
          body: parent.body,
          senderId: parent.senderId,
          hasAttachments: (parent.attachments?.length ?? 0) > 0,
        };
      }
    }

    const msg = this.msgRepo.create({
      jobId,
      senderId: userId,
      body,
      attachments,
      replyToMessageId,
      readAt: null,
    });
    const saved = await this.msgRepo.save(msg);

    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (job) {
      // A new message always pops the conversation back into both inboxes.
      let jobDirty = false;
      if (job.hiddenByCustomerAt) {
        job.hiddenByCustomerAt = null;
        jobDirty = true;
      }
      if (job.hiddenByDesignerAt) {
        job.hiddenByDesignerAt = null;
        jobDirty = true;
      }
      if (jobDirty) {
        await this.jobRepo.save(job);
      }
      const designer = await this.designerRepo.findOne({
        where: { id: job.designerId },
      });
      const preview = body
        ? body.slice(0, 120)
        : attachments.length
          ? `Sent ${attachments.length} attachment${attachments.length === 1 ? '' : 's'}`
          : 'New message';

      const otherUserId =
        userId === job.customerUserId
          ? designer?.userId ?? null
          : designer?.userId === userId
            ? job.customerUserId
            : null;

      if (otherUserId) {
        this.notifications.emitToUser(otherUserId, {
          event: 'chat_message',
          jobId,
          messageId: saved.id,
          senderId: userId,
        });
      }

      if (userId === job.customerUserId && designer?.userId) {
        const sender = await this.usersService.findById(userId);
        const senderName = this.userDisplayName(sender) || 'Customer';
        await this.notifications.create(
          designer.userId,
          'designer_message',
          `New message from ${senderName}`,
          preview,
          {
            jobId,
            messageId: saved.id,
            senderId: userId,
            senderName,
          },
        );
      } else if (designer?.userId === userId) {
        await this.notifications.create(
          job.customerUserId,
          'designer_message',
          `New message from ${designer.displayName}`,
          preview,
          {
            jobId,
            messageId: saved.id,
            senderId: userId,
            senderName: designer.displayName,
          },
        );
      }
    }
    return { ...saved, replyTo: replyPreview };
  }

  /**
   * Mark all messages in this job from the OTHER participant as read.
   * Emits a realtime `chat_read` event to the sender so the UI can flip
   * their message status to blue double-tick.
   */
  async markMessagesRead(jobId: string, userId: string) {
    const job = await this.assertJobParticipant(jobId, userId);
    const now = new Date();
    const res = await this.msgRepo
      .createQueryBuilder()
      .update()
      .set({ readAt: now })
      .where('jobId = :jobId', { jobId })
      .andWhere('senderId <> :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();

    if ((res.affected ?? 0) > 0) {
      const otherUserId = await this.getOtherParticipantUserId(job, userId);
      if (otherUserId) {
        this.notifications.emitToUser(otherUserId, {
          event: 'chat_read',
          jobId,
          readerId: userId,
          readAt: now.toISOString(),
        });
      }
    }
    return { updated: res.affected ?? 0 };
  }

  /**
   * Ephemeral typing indicator — emits a realtime `chat_typing` event to the
   * other participant. Not persisted.
   */
  async emitTyping(jobId: string, userId: string) {
    const job = await this.assertJobParticipant(jobId, userId);
    const otherUserId = await this.getOtherParticipantUserId(job, userId);
    if (otherUserId) {
      this.notifications.emitToUser(otherUserId, {
        event: 'chat_typing',
        jobId,
        senderId: userId,
        at: Date.now(),
      });
    }
    return { ok: true };
  }

  private async getOtherParticipantUserId(
    job: DesignerJob,
    userId: string,
  ): Promise<string | null> {
    if (userId === job.customerUserId) {
      const designer = await this.designerRepo.findOne({
        where: { id: job.designerId },
      });
      return designer?.userId ?? null;
    }
    return job.customerUserId;
  }

  /**
   * List the jobs the current user is a participant in.
   *  - Customers see jobs where customerUserId === user.id
   *  - Linked designers see jobs where designerId === their profile id
   */
  async listMyJobs(userId: string, status?: string) {
    const designer = await this.designerForUser(userId);

    const qb = this.jobRepo
      .createQueryBuilder('j')
      .orderBy('j.updatedAt', 'DESC');

    if (designer) {
      qb.where('(j.customerUserId = :u OR j.designerId = :d)', {
        u: userId,
        d: designer.id,
      });
    } else {
      qb.where('j.customerUserId = :u', { u: userId });
    }

    if (status && status !== 'all') {
      qb.andWhere('j.status = :status', { status });
    }

    // Apply per-user "delete chat" hide flags so the conversation disappears
    // from this user's inbox until a new message arrives.
    qb.andWhere(
      '((j.customerUserId = :u AND j.hiddenByCustomerAt IS NULL) OR ' +
        (designer
          ? '(j.designerId = :d AND j.hiddenByDesignerAt IS NULL))'
          : 'FALSE)'),
    );

    const jobs = await qb.getMany();
    if (!jobs.length) return [];

    const designerIds = [...new Set(jobs.map((j) => j.designerId))];
    const customerIds = [...new Set(jobs.map((j) => j.customerUserId))];
    const jobIds = jobs.map((j) => j.id);

    const [designers, customers, unreadRows, lastMsgRows] = await Promise.all([
      designerIds.length
        ? this.designerRepo
            .createQueryBuilder('d')
            .whereInIds(designerIds)
            .getMany()
        : Promise.resolve([]),
      customerIds.length
        ? Promise.all(customerIds.map((id) => this.usersService.findById(id)))
        : Promise.resolve([]),
      this.msgRepo
        .createQueryBuilder('m')
        .select('m.jobId', 'jobId')
        .addSelect('COUNT(1)', 'unread')
        .where('m.jobId IN (:...ids)', { ids: jobIds })
        .andWhere('m.senderId <> :userId', { userId })
        .andWhere('m.readAt IS NULL')
        .groupBy('m.jobId')
        .getRawMany<{ jobId: string; unread: string }>(),
      this.msgRepo
        .createQueryBuilder('m')
        .where('m.jobId IN (:...ids)', { ids: jobIds })
        .orderBy('m.createdAt', 'DESC')
        .getMany(),
    ]);

    const designerMap = new Map(designers.map((d) => [d.id, d]));
    const customerMap = new Map(
      customers.filter((c): c is User => !!c).map((c) => [c.id, c]),
    );
    const unreadMap = new Map(
      unreadRows.map((r) => [r.jobId, Number(r.unread) || 0]),
    );
    const lastMessageMap = new Map<
      string,
      {
        id: string;
        body: string;
        senderId: string;
        createdAt: Date;
        hasAttachments: boolean;
        attachmentCount: number;
        deletedAt: Date | null;
      }
    >();
    for (const m of lastMsgRows) {
      if (!lastMessageMap.has(m.jobId)) {
        const deleted = !!m.deletedAt;
        lastMessageMap.set(m.jobId, {
          id: m.id,
          body: deleted ? '' : m.body,
          senderId: m.senderId,
          createdAt: m.createdAt,
          hasAttachments: deleted ? false : (m.attachments?.length ?? 0) > 0,
          attachmentCount: deleted ? 0 : m.attachments?.length ?? 0,
          deletedAt: m.deletedAt ?? null,
        });
      }
    }

    return jobs.map((j) => ({
      ...j,
      designer: designerMap.get(j.designerId) ?? null,
      customer: customerMap.get(j.customerUserId)
        ? this.publicUserSummary(customerMap.get(j.customerUserId)!)
        : null,
      viewerRole:
        designer && j.designerId === designer.id ? 'designer' : 'customer',
      unreadCount: unreadMap.get(j.id) ?? 0,
      lastMessage: lastMessageMap.get(j.id) ?? null,
    }));
  }

  async getJobForUser(jobId: string, userId: string) {
    const job = await this.assertJobParticipant(jobId, userId);
    const [designer, customer] = await Promise.all([
      this.designerRepo.findOne({ where: { id: job.designerId } }),
      this.usersService.findById(job.customerUserId),
    ]);
    const linked = await this.designerForUser(userId);
    return {
      ...job,
      designer,
      customer: customer ? this.publicUserSummary(customer) : null,
      viewerRole:
        linked && job.designerId === linked.id ? 'designer' : 'customer',
    };
  }

  private publicUserSummary(user: User) {
    return {
      id: user.id,
      displayName:
        this.userDisplayName(user) ||
        user.username ||
        user.email ||
        'Customer',
      email: user.email,
      profileImage:
        (user as unknown as { profileImage?: string | null }).profileImage ??
        null,
    };
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
