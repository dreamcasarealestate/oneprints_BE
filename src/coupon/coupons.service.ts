import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coupon } from './coupon.entity';
import { CouponRedemption } from './coupon-redemption.entity';
import { CreateCouponDto } from './dto/create-coupon.dto';

export type ValidateCouponResult = {
  valid: boolean;
  coupon?: Coupon;
  discountAmount?: number;
  message?: string;
};

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(CouponRedemption)
    private readonly redemptionRepo: Repository<CouponRedemption>,
  ) {}

  // ── Admin CRUD ────────────────────────────────────────────────────

  listAll() {
    return this.couponRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getOne(id: string): Promise<Coupon> {
    const c = await this.couponRepo.findOneBy({ id });
    if (!c) throw new NotFoundException('Coupon not found');
    return c;
  }

  create(dto: CreateCouponDto): Promise<Coupon> {
    const coupon = this.couponRepo.create({
      code: dto.code.toUpperCase().trim(),
      description: dto.description ?? null,
      type: dto.type,
      value: dto.value,
      minOrderAmount: dto.minOrderAmount ?? 0,
      maxDiscount: dto.maxDiscount ?? null,
      maxUses: dto.maxUses ?? 0,
      maxUsesPerUser: dto.maxUsesPerUser ?? 0,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: dto.isActive ?? true,
      productIds: dto.productIds ?? [],
      categorySlugs: dto.categorySlugs ?? [],
    });
    return this.couponRepo.save(coupon);
  }

  async update(id: string, dto: Partial<CreateCouponDto>): Promise<Coupon> {
    const coupon = await this.getOne(id);
    if (dto.code !== undefined) coupon.code = dto.code.toUpperCase().trim();
    if (dto.description !== undefined) coupon.description = dto.description;
    if (dto.type !== undefined) coupon.type = dto.type;
    if (dto.value !== undefined) coupon.value = dto.value;
    if (dto.minOrderAmount !== undefined) coupon.minOrderAmount = dto.minOrderAmount;
    if (dto.maxDiscount !== undefined) coupon.maxDiscount = dto.maxDiscount;
    if (dto.maxUses !== undefined) coupon.maxUses = dto.maxUses;
    if (dto.maxUsesPerUser !== undefined) coupon.maxUsesPerUser = dto.maxUsesPerUser;
    if (dto.expiresAt !== undefined) coupon.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.isActive !== undefined) coupon.isActive = dto.isActive;
    if (dto.productIds !== undefined) coupon.productIds = dto.productIds;
    if (dto.categorySlugs !== undefined) coupon.categorySlugs = dto.categorySlugs;
    return this.couponRepo.save(coupon);
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const coupon = await this.getOne(id);
    await this.couponRepo.remove(coupon);
    return { id, deleted: true };
  }

  // ── Validation (called from cart / checkout) ──────────────────────

  async validate(
    code: string,
    orderAmount: number,
    userId: string,
  ): Promise<ValidateCouponResult> {
    const coupon = await this.couponRepo.findOneBy({ code: code.toUpperCase().trim() });
    if (!coupon) return { valid: false, message: 'Invalid coupon code.' };
    if (!coupon.isActive) return { valid: false, message: 'This coupon is no longer active.' };
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return { valid: false, message: 'This coupon has expired.' };
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) return { valid: false, message: 'This coupon has reached its usage limit.' };
    if (orderAmount < Number(coupon.minOrderAmount)) {
      return { valid: false, message: `Minimum order amount ₹${coupon.minOrderAmount} required.` };
    }
    if (coupon.maxUsesPerUser > 0) {
      const userUses = await this.redemptionRepo.countBy({ couponId: coupon.id, userId });
      if (userUses >= coupon.maxUsesPerUser) return { valid: false, message: 'You have already used this coupon.' };
    }

    let discountAmount = 0;
    if (coupon.type === 'percent') {
      discountAmount = (orderAmount * Number(coupon.value)) / 100;
      if (coupon.maxDiscount && discountAmount > Number(coupon.maxDiscount)) {
        discountAmount = Number(coupon.maxDiscount);
      }
    } else if (coupon.type === 'fixed') {
      discountAmount = Math.min(Number(coupon.value), orderAmount);
    } else if (coupon.type === 'free_shipping') {
      discountAmount = 0; // shipping discount handled at checkout
    }

    return { valid: true, coupon, discountAmount: Math.round(discountAmount * 100) / 100 };
  }

  async redeem(
    couponId: string,
    userId: string,
    orderId: string,
    discountAmount: number,
  ): Promise<CouponRedemption> {
    await this.couponRepo.increment({ id: couponId }, 'usedCount', 1);
    const redemption = this.redemptionRepo.create({ couponId, userId, orderId, discountAmount });
    return this.redemptionRepo.save(redemption);
  }

  listRedemptions(couponId: string) {
    return this.redemptionRepo.find({
      where: { couponId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
