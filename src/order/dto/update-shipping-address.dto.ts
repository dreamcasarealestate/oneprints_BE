import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * Customer-facing shipping-address edit payload used by the user
 * order detail page. We validate strictly so the saved address book
 * row (when synced) and the order snapshot stay clean.
 */
export class UpdateOrderShippingAddressDto {
  @ApiProperty({ minLength: 2 })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty()
  @IsString()
  @MinLength(7)
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  addressLine1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  city: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  state: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  country: string;

  @ApiProperty({ example: '560001' })
  @IsString()
  @Matches(/^\d{4,10}$/)
  pinCode: string;

  @ApiPropertyOptional({ description: 'Browser geolocation lat (optional).' })
  @IsOptional()
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Browser geolocation lng (optional).' })
  @IsOptional()
  @IsNumber()
  @IsLongitude()
  longitude?: number;

  /**
   * When true (default), also sync this address into the user's
   * saved address book — updating the matching saved row if one
   * exists, otherwise creating a new entry. Set false when the
   * shopper is intentionally editing only the order snapshot.
   */
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  syncToAddressBook?: boolean;
}
