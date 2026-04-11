import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class OrderReturnDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
