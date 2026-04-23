import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
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

export class ProductVariantDto {
  @ApiPropertyOptional({ description: 'Stable key — defaults to slug of colorName server-side when omitted.' })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiProperty({ description: 'Display colour name. Must be unique within the product.' })
  @IsString()
  @MinLength(1)
  colorName: string;

  @ApiPropertyOptional({ description: 'Optional hex swatch, e.g. "#1a2b3c".' })
  @IsOptional()
  @IsString()
  colorHex?: string | null;

  @ApiProperty({ description: 'MRP / strike-through price for this colour variant.' })
  @IsNumber()
  @Min(0)
  mrp: number;

  @ApiProperty({ description: 'Actual selling price for this colour variant.' })
  @IsNumber()
  @Min(0)
  sellingPrice: number;

  @ApiPropertyOptional({ description: 'Discount % — defaults to derived from mrp/sellingPrice.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @ApiPropertyOptional({ description: 'Units on hand. null/omitted = treat as unlimited.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
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

  @ApiPropertyOptional({ type: [String], description: 'Blank / template images (no existing designs) for the design editor — products without colour variants.' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blankImages?: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    description: 'Blank / template image URLs per colour key for the design editor canvas background.',
  })
  @IsOptional()
  @IsObject()
  blankImagesByColour?: Record<string, string[] | string>;

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

  @ApiPropertyOptional({ type: [String], description: 'Printable sides/views, e.g. ["front","back"]. Defaults to ["front"].' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  printSides?: string[];

  @ApiPropertyOptional({
    type: 'object',
    description: 'Per-side per-colour blank template images: { sideId: { colourKey: [urls] } }.',
  })
  @IsOptional()
  @IsObject()
  blankImagesBySideColour?: Record<string, Record<string, string[]>>;

  @ApiPropertyOptional({
    type: 'object',
    description:
      'Per-side per-colour storefront/display images: { sideId: { colourKey: [urls] } }.',
  })
  @IsOptional()
  @IsObject()
  imagesBySideColour?: Record<string, Record<string, string[]>>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availableColours?: string[];

  @ApiPropertyOptional({
    type: [ProductVariantDto],
    description:
      'Per-colour variant rows with their own MRP, selling price, stock, and images. When non-empty, the storefront uses these instead of flat basePrice/imagesByColour/stockQuantity.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

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

  @ApiPropertyOptional({ enum: ['men', 'women', 'kids'] })
  @IsOptional()
  @IsIn(['men', 'women', 'kids'])
  apparelDesignerGender?: 'men' | 'women' | 'kids' | null;

  @ApiPropertyOptional({
    description:
      'Apparel subtype slug (shirts, t-shirts, …) — must match gender when category is apparel.',
  })
  @IsOptional()
  @IsString()
  apparelDesignerSubtype?: string | null;

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
