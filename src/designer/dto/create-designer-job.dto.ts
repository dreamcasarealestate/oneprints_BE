import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateDesignerJobDto {
  @ApiProperty()
  @IsUUID()
  designerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  brief: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetInr?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deadlineText?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceAssetUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designDraftJson?: string;
}
