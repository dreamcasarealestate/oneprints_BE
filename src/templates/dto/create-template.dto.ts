import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TEMPLATE_STATUSES, type TemplateStatus } from '../template.entity';

/**
 * One customer-fillable form input. Authored by the admin alongside
 * the canvas — e.g. "Full Name" → bound to a Fabric text object on
 * the visiting card. Hydrated into the studio's left-side form
 * panel for the customer.
 *
 * `slotId` is the bridge: when the studio loads a template canvas
 * it tags the text objects with `data.slotId = field.id` so the
 * form input mutates exactly the right object.
 */
export class TemplateFieldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slotId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  defaultValue?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  helperText?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxLength?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  side?: string | null;

  /**
   * Reserved for future field types ('qr', 'date', 'image', …).
   * Today the studio only renders 'text' — kept permissive so the
   * column can grow without DB / DTO churn.
   */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  kind?: string | null;
}

/**
 * One swatch in the template's color palette (e.g. "Wine Red").
 * Authored by the admin; rendered as a clickable chip in the
 * studio's "Template color" panel. The `palette` map drives the
 * actual recolor so a single click can repaint background + accents
 * + text in one go (matches VistaPrint behaviour).
 */
export class TemplateColorVariantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  label: string;

  @IsHexColor()
  swatchHex: string;

  @IsOptional()
  @IsObject()
  palette?: Record<string, string> | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean | null;
}

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

  /**
   * Admin-authored list of customer-fillable form inputs (Phase 2
   * studio surface). Each entry points at a Fabric text object via
   * `slotId`; the studio renders the inputs in the left-side
   * "Fill in the fields" panel and pipes typed values into the
   * canvas. Optional — flat-canvas (non-form) templates can ship
   * with an empty array and still work as static designs.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  editableFields?: TemplateFieldDto[];

  /**
   * Admin-authored color palette. When supplied, the studio's
   * "Template color" panel uses this instead of heuristic color
   * discovery — gives the admin exact control over which swatches
   * appear and what they recolor on the canvas.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateColorVariantDto)
  colorVariants?: TemplateColorVariantDto[];

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
