import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AddToCartDto } from './add-to-cart.dto';

/**
 * Payload for `PATCH /cart/sync` — the storefront sends the full
 * canonical cart (typically the merge of the locally-stored guest
 * cart and the server cart) and the BE replaces its items with this
 * snapshot. Idempotent and safe to retry.
 */
export class SyncCartDto {
  @ApiProperty({ type: [AddToCartDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddToCartDto)
  items: AddToCartDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  couponCode?: string;
}
