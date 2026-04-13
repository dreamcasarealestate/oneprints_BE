import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpsertCorporateAccountDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  companyName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  poCapability?: boolean;

  @ApiPropertyOptional({
    description: 'Ignored for self-service; set by admin via separate flow',
  })
  @IsOptional()
  @IsNumber()
  creditLimit?: number;
}
