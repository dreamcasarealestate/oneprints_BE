import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class BulkTierDto {
  @IsNumber()
  @Min(1)
  minQty: number;

  @IsNumber()
  @Min(0)
  pricePerUnit: number;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  sku: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiPropertyOptional({ type: [BulkTierDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkTierDto)
  bulkTiers?: BulkTierDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  printAreas?: Record<string, unknown>[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableColours?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableSizes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  minOrderQty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  productionTimeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  supportsEditor?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  supportsCustomMeasurement?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  supportsDesignerMarketplace?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  branchAvailability?: string[] | null;
}
