import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ example: 'OnePrints Hyderabad' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerUserId?: string;

  @ApiPropertyOptional({ type: [String], example: ['500', '501', '502'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  pinCodePrefixes?: string[];

  @ApiPropertyOptional({
    example: 17.385,
    description:
      'Optional branch latitude. When provided together with longitude, used as a tiebreaker against the shipping address coordinates.',
  })
  @IsOptional()
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: 78.4867 })
  @IsOptional()
  @IsNumber()
  @IsLongitude()
  longitude?: number;
}
