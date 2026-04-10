import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { PrintOrderStatus } from '../print-order.entity';

const STATUSES: PrintOrderStatus[] = [
  'pending',
  'in_review',
  'in_production',
  'shipped',
  'completed',
  'cancelled',
];

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: STATUSES,
    example: 'in_review',
    description: 'Next order status in the production workflow',
  })
  @IsString()
  @IsIn(STATUSES)
  status: PrintOrderStatus;
}
