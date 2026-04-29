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
import { ProductionService, CreateProductionJobDto, UpdateProductionJobDto } from './production.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { ProductionStatus } from './production-job.entity';
import { CATALOGUE_ADMIN_ROLES, STAFF_OPERATION_ROLES } from '../user/roles.util';

@Controller('production')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_OPERATION_ROLES)
export class ProductionController {
  constructor(private readonly svc: ProductionService) {}

  @Get()
  list(
    @Query('branchId') branchId?: string,
    @Query('status') status?: ProductionStatus,
    @Query('orderId') orderId?: string,
  ) {
    return this.svc.list({ branchId, status, orderId });
  }

  @Get('stats')
  stats(@Query('branchId') branchId?: string) {
    return this.svc.stats(branchId);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.svc.getOne(id);
  }

  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Post()
  create(@Body() dto: CreateProductionJobDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductionJobDto) {
    return this.svc.update(id, dto);
  }

  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
