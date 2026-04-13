import {
  BadRequestException,
  Injectable,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Subject, merge, interval, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Notification } from './notification.entity';
import { User } from '../user/user.entity';
import { UserKind } from '../user/user-kind.enum';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UsersService } from '../user/users.service';

export type ListNotificationsOpts = {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  type?: string;
  priority?: 'low' | 'normal' | 'high';
  includeArchived?: boolean;
  /** When true, include items with snoozedUntil in the future */
  includeSnoozed?: boolean;
};

export type CreateNotificationOpts = {
  priority?: 'low' | 'normal' | 'high';
  actionUrl?: string | null;
  channel?: string;
  dedupeKey?: string | null;
};

@Injectable()
export class NotificationsService {
  private readonly userStreams = new Map<string, Subject<MessageEvent>>();

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly usersService: UsersService,
  ) {}

  subscribeStream(userId: string): Observable<MessageEvent> {
    let subj = this.userStreams.get(userId);
    if (!subj) {
      subj = new Subject<MessageEvent>();
      this.userStreams.set(userId, subj);
    }
    const keepAlive = interval(25_000).pipe(
      map((): MessageEvent => ({
        data: JSON.stringify({ event: 'ping', ts: Date.now() }),
      })),
    );
    return merge(subj.asObservable(), keepAlive);
  }

  private emitStream(userId: string, payload: unknown) {
    this.userStreams.get(userId)?.next({
      data: JSON.stringify(payload),
    });
  }

  async create(
    userId: string,
    type: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown> | null,
    opts?: CreateNotificationOpts,
  ): Promise<Notification | null> {
    const user = await this.usersService.findById(userId);
    const muted =
      (user?.notificationPreferences?.mutedTypes as string[] | undefined) ??
      [];
    if (muted.includes(type)) {
      return null;
    }

    const dedupeKey = opts?.dedupeKey ?? null;
    if (dedupeKey) {
      const existing = await this.repo
        .createQueryBuilder('n')
        .where('n.userId = :userId', { userId })
        .andWhere('n.dedupeKey = :dk', { dk: dedupeKey })
        .andWhere(`n."createdAt" > NOW() - INTERVAL '24 hours'`)
        .getOne();
      if (existing) {
        return existing;
      }
    }

    const n = this.repo.create({
      userId,
      type,
      title,
      message,
      metadata: metadata ?? null,
      priority: opts?.priority ?? 'normal',
      channel: opts?.channel ?? 'in_app',
      actionUrl: opts?.actionUrl ?? null,
      dedupeKey,
    });
    const saved = await this.repo.save(n);
    this.emitStream(userId, { event: 'notification', notification: saved });
    return saved;
  }

  adminCreate(dto: CreateNotificationDto) {
    return this.create(
      dto.userId,
      dto.type,
      dto.title,
      dto.message,
      dto.metadata,
      {
        priority: dto.priority,
        actionUrl: dto.actionUrl ?? null,
        channel: dto.channel,
        dedupeKey: dto.dedupeKey ?? null,
      },
    );
  }

  notifyOrderPlaced(userId: string, orderId: string) {
    return this.create(
      userId,
      'order',
      'Order placed',
      `Your order #${orderId.slice(0, 8)} has been placed successfully.`,
      { orderId, event: 'order_placed' },
      { dedupeKey: `order_placed:${orderId}` },
    );
  }

  async notifyBranchStaff(
    branchId: string,
    orderId: string,
    message: string,
  ) {
    const recipients = await this.usersRepo.find({
      where: {
        branchId,
        userKind: In([
          UserKind.ADMIN,
          UserKind.BRANCH_MANAGER,
          UserKind.STAFF,
          UserKind.BRANCH_STAFF,
        ]),
      },
      select: ['id'],
    });

    if (!recipients.length) return [];

    return Promise.all(
      recipients.map((u) =>
        this.create(
          u.id,
          'order',
          'New branch order',
          message,
          { orderId, branchId, event: 'branch_order_created' },
          { dedupeKey: `branch_order:${orderId}:${u.id}` },
        ),
      ),
    );
  }

  notifyOrderStatus(
    userId: string,
    orderId: string,
    status: string,
    statusLabel: string,
  ) {
    return this.create(
      userId,
      'order',
      `Order update: ${statusLabel}`,
      `Order #${orderId.slice(0, 8)} status changed to ${statusLabel}.`,
      { orderId, status, event: 'order_status_changed' },
      {
        priority: status === 'cancelled' ? 'high' : 'normal',
        dedupeKey: `order_status:${orderId}:${status}`,
      },
    );
  }

  private activeSnoozeClause(alias = 'n') {
    return `( ${alias}."snoozedUntil" IS NULL OR ${alias}."snoozedUntil" <= NOW() )`;
  }

  async summary(userId: string) {
    const qbBase = this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.archivedAt IS NULL')
      .andWhere(this.activeSnoozeClause('n'));

    const total = await qbBase.clone().getCount();

    const unread = await qbBase
      .clone()
      .andWhere('n.readAt IS NULL')
      .getCount();

    const byTypeRaw = await this.repo
      .createQueryBuilder('n')
      .select('n.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('n.userId = :userId', { userId })
      .andWhere('n.archivedAt IS NULL')
      .andWhere(this.activeSnoozeClause('n'))
      .groupBy('n.type')
      .getRawMany<{ type: string; count: string }>();

    const unreadByPriority = await this.repo
      .createQueryBuilder('n')
      .select('n.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .where('n.userId = :userId', { userId })
      .andWhere('n.readAt IS NULL')
      .andWhere('n.archivedAt IS NULL')
      .andWhere(this.activeSnoozeClause('n'))
      .groupBy('n.priority')
      .getRawMany<{ priority: string; count: string }>();

    return {
      total,
      unread,
      byType: Object.fromEntries(
        byTypeRaw.map((r) => [r.type, Number(r.count)]),
      ),
      unreadByPriority: Object.fromEntries(
        unreadByPriority.map((r) => [r.priority, Number(r.count)]),
      ),
    };
  }

  async listForUser(userId: string, opts: ListNotificationsOpts = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .orderBy('n.createdAt', 'DESC')
      .skip(offset)
      .take(limit);
    if (!opts.includeArchived) {
      qb.andWhere('n.archivedAt IS NULL');
    }
    if (!opts.includeSnoozed) {
      qb.andWhere(this.activeSnoozeClause('n'));
    }
    if (opts.unreadOnly) {
      qb.andWhere('n.readAt IS NULL');
    }
    if (opts.type?.trim()) {
      qb.andWhere('n.type = :type', { type: opts.type.trim() });
    }
    if (opts.priority) {
      qb.andWhere('n.priority = :priority', { priority: opts.priority });
    }
    return qb.getMany();
  }

  async markRead(userId: string, id: string) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) return null;
    n.readAt = new Date();
    const saved = await this.repo.save(n);
    this.emitStream(userId, { event: 'read', id });
    return saved;
  }

  async markAllRead(userId: string) {
    const res = await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'NOW()' })
      .where('userId = :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();
    this.emitStream(userId, { event: 'read_all', updated: res.affected ?? 0 });
    return { updated: res.affected ?? 0 };
  }

  async markReadBatch(userId: string, ids: string[]) {
    if (!ids.length) return { updated: 0 };
    const res = await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'NOW()' })
      .where('userId = :userId', { userId })
      .andWhere('id IN (:...ids)', { ids })
      .andWhere('readAt IS NULL')
      .execute();
    this.emitStream(userId, { event: 'read_batch', ids });
    return { updated: res.affected ?? 0 };
  }

  async deleteOne(userId: string, id: string) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    await this.repo.remove(n);
    this.emitStream(userId, { event: 'deleted', id });
    return { id, deleted: true };
  }

  async purgeRead(userId: string) {
    const res = await this.repo
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('userId = :userId', { userId })
      .andWhere('readAt IS NOT NULL')
      .execute();
    this.emitStream(userId, { event: 'purged_read', deleted: res.affected ?? 0 });
    return { deleted: res.affected ?? 0 };
  }

  async archiveOne(userId: string, id: string) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    n.archivedAt = new Date();
    const saved = await this.repo.save(n);
    this.emitStream(userId, { event: 'archived', id });
    return saved;
  }

  async digest(userId: string) {
    const items = await this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.readAt IS NULL')
      .andWhere('n.archivedAt IS NULL')
      .andWhere(this.activeSnoozeClause('n'))
      .orderBy('n.createdAt', 'DESC')
      .take(25)
      .getMany();

    const subject =
      items.length === 0
        ? 'No unread notifications'
        : `You have ${items.length} unread notification${items.length === 1 ? '' : 's'}`;

    const lines = items.map(
      (n) => `• [${n.type}] ${n.title}: ${n.message.replace(/\s+/g, ' ').slice(0, 120)}`,
    );

    return {
      subject,
      generatedAt: new Date().toISOString(),
      textBody: [subject, '', ...lines].join('\n'),
      notifications: items,
    };
  }

  async snooze(
    userId: string,
    id: string,
    snoozedUntil?: string,
    snoozeMinutes?: number,
  ) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    let until: Date;
    if (snoozeMinutes != null && snoozeMinutes > 0) {
      until = new Date(Date.now() + snoozeMinutes * 60_000);
    } else if (snoozedUntil) {
      until = new Date(snoozedUntil);
      if (Number.isNaN(until.getTime())) {
        throw new BadRequestException('Invalid snoozedUntil');
      }
    } else {
      throw new BadRequestException('Provide snoozedUntil or snoozeMinutes');
    }
    n.snoozedUntil = until;
    const saved = await this.repo.save(n);
    this.emitStream(userId, { event: 'snoozed', id, snoozedUntil: until });
    return saved;
  }

  async clearSnooze(userId: string, id: string) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    n.snoozedUntil = null;
    return this.repo.save(n);
  }
}
