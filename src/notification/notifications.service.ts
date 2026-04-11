import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { User } from '../user/user.entity';
import { UserKind } from '../user/user-kind.enum';
import { CreateNotificationDto } from './dto/create-notification.dto';

export type ListNotificationsOpts = {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async create(
    userId: string,
    type: string,
    title: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    const n = this.repo.create({
      userId,
      type,
      title,
      message,
      metadata: metadata ?? null,
    });
    return this.repo.save(n);
  }

  adminCreate(dto: CreateNotificationDto) {
    return this.create(
      dto.userId,
      dto.type,
      dto.title,
      dto.message,
      dto.metadata,
    );
  }

  notifyOrderPlaced(userId: string, orderId: string) {
    return this.create(
      userId,
      'order',
      'Order placed',
      `Your order #${orderId.slice(0, 8)} has been placed successfully.`,
      { orderId, event: 'order_placed' },
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
        userKind: In([UserKind.BRANCH_MANAGER, UserKind.STAFF]),
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
    );
  }

  async summary(userId: string) {
    const total = await this.repo.count({ where: { userId } });
    const unread = await this.repo.count({
      where: { userId, readAt: null as unknown as undefined },
    });
    const unreadReal = await this.repo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.readAt IS NULL')
      .getCount();
    return { total, unread: unreadReal };
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
    if (opts.unreadOnly) {
      qb.andWhere('n.readAt IS NULL');
    }
    return qb.getMany();
  }

  listForUserLegacy(userId: string) {
    return this.listForUser(userId, { limit: 100, offset: 0 });
  }

  async markRead(userId: string, id: string) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) return null;
    n.readAt = new Date();
    return this.repo.save(n);
  }

  async markAllRead(userId: string) {
    const res = await this.repo
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: () => 'NOW()' })
      .where('userId = :userId', { userId })
      .andWhere('readAt IS NULL')
      .execute();
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
    return { updated: res.affected ?? 0 };
  }

  async deleteOne(userId: string, id: string) {
    const n = await this.repo.findOne({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    await this.repo.remove(n);
    return { id, deleted: true };
  }

  async deleteAllRead(userId: string) {
    const res = await this.repo.delete({
      userId,
      readAt: NotNullReadAt(),
    } as never);
    await this.repo
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('userId = :userId', { userId })
      .andWhere('readAt IS NOT NULL')
      .execute();
    return { deleted: res.affected ?? 0 };
  }
}

/** TypeORM delete with non-null readAt — use query builder instead */
function NotNullReadAt(): Date {
  return null as unknown as Date;
}
