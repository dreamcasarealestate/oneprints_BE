import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateDesignerProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializations?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  portfolioUrls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseRateInr?: number;

  @ApiPropertyOptional({ enum: ['hourly', 'project'] })
  @IsOptional()
  @IsIn(['hourly', 'project'])
  rateType?: 'hourly' | 'project';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  yearsExperience?: number;

  @ApiPropertyOptional({ enum: ['available', 'busy', 'on_leave'] })
  @IsOptional()
  @IsIn(['available', 'busy', 'on_leave'])
  availability?: 'available' | 'busy' | 'on_leave';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  turnaroundText?: string;
}
