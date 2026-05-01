import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TemplateSideDto {
  @IsString()
  @MaxLength(40)
  id: string;

  @IsString()
  @MaxLength(60)
  label: string;
}

export class UpdateTemplateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9][a-z0-9-]*$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  iconUrl?: string | null;

  @IsOptional()
  @IsString()
  coverUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(50)
  defaultCanvasWidth?: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  defaultCanvasHeight?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultBleedPx?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSideDto)
  defaultSides?: TemplateSideDto[];

  @IsOptional()
  @IsObject()
  printSpec?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
