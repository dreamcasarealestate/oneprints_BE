import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { TEMPLATE_STATUSES, type TemplateStatus } from '../template.entity';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  height?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsObject()
  canvasState: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  /**
   * Only honoured when the caller has admin role; the controller will
   * defensively force `pending` for non-admin submissions regardless
   * of what is sent here.
   */
  @IsOptional()
  @IsIn(TEMPLATE_STATUSES)
  status?: TemplateStatus;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
