import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatusLog } from './order-status-log.entity';
import { Payment } from '../payment/payment.entity';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';
import { OrdersController } from './orders.controller';
import { BranchModule } from '../branch/branch.module';
import { NotificationsModule } from '../notification/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderStatusLog, Payment]),
    BranchModule,
    NotificationsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PaymentsService],
  exports: [OrdersService, PaymentsService],
})
export class OrdersModule {}
