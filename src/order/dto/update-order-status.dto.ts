import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../order.entity';

const STATUSES: OrderStatus[] = [
  'pending',
  'order_placed',
  'payment_pending',
  'payment_confirmed',
  'design_pending',
  'in_review',
  'in_production',
  'qc_check',
  'ready_for_dispatch',
  'dispatched',
  'out_for_delivery',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'return_requested',
  'refunded',
];

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: STATUSES })
  @IsString()
  @IsIn(STATUSES)
  status: OrderStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
