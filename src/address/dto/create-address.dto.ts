import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  phone: string;

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

  @ApiProperty()
  @IsString()
  @MinLength(3)
  pinCode: string;
}
