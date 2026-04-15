import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
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

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    description:
      'Map of colour (as in availableColours) to image URL list for that variant. Legacy clients may send one string per key.',
  })
  @IsOptional()
  @IsObject()
  imagesByColour?: Record<string, string[] | string>;

  @ApiPropertyOptional({
    type: [Object],
    description: 'Category-specific custom sections and form fields saved with the product.',
  })
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  customSections?: Record<string, unknown>[];

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
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  restockNote?: string | null;
}
