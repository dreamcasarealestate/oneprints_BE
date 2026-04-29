import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Patch payload for `PATCH /cart/meta`. Lets the storefront persist
 * coupon code, currency, or arbitrary metadata buckets (e.g. last
 * shipping/billing address selection) without touching cart items.
 */
export class UpdateCartMetaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  shippingDetails?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  billingDetails?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
