import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../order/order.entity';
import { User } from '../user/user.entity';
import { Product } from '../catalogue/product.entity';
import { DesignersService } from '../designer/designers.service';
import { CatalogueService } from '../catalogue/catalogue.service';
import { RejectDesignerDto } from '../designer/dto/reject-designer.dto';
import { ApplyDesignerDto } from '../designer/dto/apply-designer.dto';
import { Payout } from '../payout/payout.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { DesignerProfileStatus } from '../designer/designer.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly designers: DesignersService,
    private readonly catalogue: CatalogueService,
  ) {}

  async analytics() {
    const [orderCount, userCount, productCount, revenueRow, ordersByStatus] =
      await Promise.all([
        this.ordersRepo.count(),
        this.usersRepo.count(),
        this.productsRepo.count(),
        this.ordersRepo
          .createQueryBuilder('o')
          .select('COALESCE(SUM(o.totalAmount),0)', 'sum')
          .getRawOne<{ sum: string }>(),
        this.ordersRepo
          .createQueryBuilder('o')
          .select('o.status', 'status')
          .addSelect('COUNT(*)', 'count')
          .groupBy('o.status')
          .getRawMany<{ status: string; count: string }>(),
      ]);

    return {
      ordersTotal: orderCount,
      usersTotal: userCount,
      productsTotal: productCount,
      revenueInr: Number(revenueRow?.sum ?? 0),
      ordersByStatus: Object.fromEntries(
        ordersByStatus.map((r) => [r.status, Number(r.count)]),
      ),
    };
  }

  pendingDesigners() {
    return this.designers.listPending();
  }

  listDesigners(
    options: {
      search?: string;
      specialization?: string;
      rateType?: 'hourly' | 'project' | 'all';
      status?: DesignerProfileStatus | 'all';
      page?: number;
      limit?: number;
    } = {},
  ) {
    return this.designers.listAdminDesigners(options);
  }

  approveDesigner(id: string) {
    return this.designers.approveDesigner(id);
  }

  approveDesignerWithActor(id: string, actor: User) {
    return this.designers.approveDesigner(id, actor);
  }

  rejectDesigner(id: string, dto: RejectDesignerDto, actor?: User) {
    return this.designers.rejectDesigner(id, dto, actor);
  }

  setDesignerStatus(
    id: string,
    status: Extract<DesignerProfileStatus, 'approved' | 'suspended'>,
    actor?: User,
  ) {
    return this.designers.setDesignerStatus(id, status, actor);
  }

  deleteDesigner(id: string) {
    return this.designers.deleteDesigner(id);
  }

  /**
   * Submit a marketplace designer application from the admin portal (ops).
   *
   * Admin-created designer profiles are auto-approved on the same call so the
   * linked user is immediately promoted to `userKind = designer` and can sign
   * in as a designer without a second approval step.
   */
  async adminSubmitDesignerApplication(dto: ApplyDesignerDto, actor?: User) {
    const created = await this.designers.apply(dto);
    return this.designers.approveDesigner(created.id, actor);
  }

  bulkImportProducts(csv: string) {
    return this.catalogue.bulkImportFromCsv(csv);
  }

  listPayouts() {
    return this.payoutRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['designer', 'order'],
      take: 500,
    });
  }

  createPayout(dto: CreatePayoutDto) {
    const p = this.payoutRepo.create({
      designerId: dto.designerId,
      orderId: dto.orderId,
      amount: dto.amount,
      payoutMethod: dto.payoutMethod ?? null,
      status: dto.status ?? 'pending',
    });
    return this.payoutRepo.save(p);
  }

  listAuditLogs(limit = 100, offset = 0) {
    const take = Math.min(Math.max(limit, 1), 500);
    const skip = Math.max(offset, 0);
    return this.auditRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['actor'],
      take,
      skip,
    });
  }
}
