import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../payment/payment.entity';
import { User } from '../user/user.entity';
import { OrdersService } from './orders.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly payRepo: Repository<Payment>,
    private readonly ordersService: OrdersService,
  ) {}

  async listForOrder(orderId: string, customerId: string | null, actor: User | null) {
    await this.ordersService.findOneForUser(orderId, customerId, actor);
    return this.payRepo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
  }

  async record(
    orderId: string,
    dto: CreatePaymentDto,
    customerId: string | null,
    actor: User | null,
  ) {
    await this.ordersService.findOneForUser(orderId, customerId, actor);
    const p = this.payRepo.create({
      orderId,
      amount: dto.amount,
      status: dto.status,
      method: dto.method ?? null,
      razorpayPaymentId: dto.razorpayPaymentId ?? null,
      razorpayOrderId: dto.razorpayOrderId ?? null,
    });
    return this.payRepo.save(p);
  }
}
