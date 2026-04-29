import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CATALOGUE_ADMIN_ROLES } from '../user/roles.util';

class ValidateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  orderAmount: number;
}

@Controller('coupons')
@UseGuards(JwtAuthGuard)
export class CouponsController {
  constructor(private readonly svc: CouponsService) {}

  // ── Customer: validate a coupon code ─────────────────────────────
  @Post('validate')
  validate(@Body() dto: ValidateCouponDto, @CurrentUser() user: User) {
    return this.svc.validate(dto.code, dto.orderAmount, user.id);
  }

  // ── Admin routes ─────────────────────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Get()
  listAll() {
    return this.svc.listAll();
  }

  @UseGuards(RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.svc.getOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.svc.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateCouponDto>) {
    return this.svc.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  @UseGuards(RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Get(':id/redemptions')
  redemptions(@Param('id') id: string) {
    return this.svc.listRedemptions(id);
  }
}
