import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: ['pending', 'captured', 'failed', 'refunded'] })
  @IsString()
  status: 'pending' | 'captured' | 'failed' | 'refunded';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  razorpayPaymentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  razorpayOrderId?: string;
}
