import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/order.entity';
import { User } from '../user/user.entity';
import { Product } from '../catalogue/product.entity';
import { Payout } from '../payout/payout.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { DesignerModule } from '../designer/designer.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User, Product, Payout, AuditLog]),
    DesignerModule,
    CatalogueModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
