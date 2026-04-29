import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Payload for `POST /cart/items` — kept loose so the storefront can
 * push the same shape it already serialises into local cart lines
 * (size, colour, designId, side thumbnails, custom field values).
 *
 * `productId` is optional only to keep the BE forward-compatible with
 * non-catalogue verticals; the storefront always provides it.
 */
export class AddToCartDto {
  @ApiPropertyOptional({ description: 'Catalogue product UUID' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Optional variant key (slug of colour/size).',
  })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ description: 'Name snapshot (kept on the cart line).' })
  @IsString()
  @MinLength(1)
  productName: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Per-piece price the customer agreed to.' })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitDiscount?: number;

  @ApiPropertyOptional({ description: 'GST / tax percent for this line.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({
    description:
      'UUID of a previously-saved design row in the design studio.',
  })
  @IsOptional()
  @IsUUID()
  designId?: string;

  @ApiPropertyOptional({
    description: 'Storefront product image for the selected colour.',
  })
  @IsOptional()
  @IsString()
  productImage?: string;

  @ApiPropertyOptional({ description: 'Blank product template image.' })
  @IsOptional()
  @IsString()
  blankImage?: string;

  @ApiPropertyOptional({
    description: "Customer's design thumbnail (data-URL or hosted PNG).",
  })
  @IsOptional()
  @IsString()
  designThumbnail?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Per-side design thumbnails for multi-side products.',
  })
  @IsOptional()
  @IsObject()
  sideThumbnails?: Record<string, string | null>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  printSides?: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Custom field values from category-defined product fields.',
  })
  @IsOptional()
  @IsObject()
  customFieldValues?: Record<string, string>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description:
      'Free-form snapshot bag (image / brand / sku / source / attributes).',
  })
  @IsOptional()
  @IsObject()
  snapshot?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
