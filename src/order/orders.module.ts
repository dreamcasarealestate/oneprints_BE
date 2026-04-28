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
import { AddressesModule } from '../address/addresses.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderStatusLog, Payment]),
    BranchModule,
    NotificationsModule,
    // Bring in the Address repository so we can keep an order's shipping
    // address in sync with the matching saved address when the customer
    // edits it from the order detail page.
    AddressesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PaymentsService],
  exports: [OrdersService, PaymentsService],
})
export class OrdersModule {}
