import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrintOrder } from './print-order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(PrintOrder)
    private readonly ordersRepo: Repository<PrintOrder>,
  ) {}

  createForUser(userId: string, dto: CreateOrderDto) {
    const order = this.ordersRepo.create({
      userId,
      productCategory: dto.productCategory,
      description: dto.description,
      designNotes: dto.designNotes ?? null,
    });
    return this.ordersRepo.save(order);
  }

  findMine(userId: string) {
    return this.ordersRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  findAll() {
    return this.ordersRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.ordersRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    order.status = dto.status;
    return this.ordersRepo.save(order);
  }
}
