import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePayoutDto {
  @ApiProperty()
  @IsUUID()
  designerId: string;

  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payoutMethod?: string;

  @ApiPropertyOptional({ enum: ['pending', 'processing', 'paid', 'failed'] })
  @IsOptional()
  @IsString()
  status?: 'pending' | 'processing' | 'paid' | 'failed';
}
