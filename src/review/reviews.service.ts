import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { Order } from '../order/order.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  listByDesigner(designerId: string) {
    return this.reviewRepo.find({
      where: { designerId },
      order: { createdAt: 'DESC' },
      relations: ['reviewer'],
      take: 100,
    });
  }

  listMine(reviewerId: string) {
    return this.reviewRepo.find({
      where: { reviewerId },
      order: { createdAt: 'DESC' },
      relations: ['order', 'designer'],
    });
  }

  async create(reviewerId: string, dto: CreateReviewDto) {
    const order = await this.orderRepo.findOne({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== reviewerId) throw new ForbiddenException();

    const existing = await this.reviewRepo.findOne({
      where: { orderId: dto.orderId, reviewerId },
    });
    if (existing) {
      throw new ConflictException('You already reviewed this order');
    }

    const r = this.reviewRepo.create({
      orderId: dto.orderId,
      reviewerId,
      designerId: dto.designerId ?? null,
      stars: dto.stars,
      comment: dto.comment?.trim() ?? null,
    });
    return this.reviewRepo.save(r);
  }
}
