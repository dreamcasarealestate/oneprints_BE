import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class DispatchOrderDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  trackingId: string;

  @ApiPropertyOptional({ example: 'Delhivery' })
  @IsOptional()
  @IsString()
  logisticsPartner?: string;
}
