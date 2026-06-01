import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
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
  @IsNotEmpty()
  @MaxLength(40)
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label: string;
}

export class CreateTemplateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message:
      'slug must be lowercase alphanumeric with single hyphens (e.g. "business-card")',
  })
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsInt()
  @Min(50)
  defaultCanvasWidth: number;

  @IsInt()
  @Min(50)
  defaultCanvasHeight: number;

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

  /**
   * Optional snake_case slug of the {@link ProductCategory} this
   * template category represents (e.g. `visiting_cards`, `labels`,
   * `stickers`, `packaging`). Lets the studio's product-binder
   * pick the right product list even though the two taxonomies
   * use different slug conventions.
   *
   * Pattern is intentionally permissive — product slugs use
   * snake_case while template slugs are kebab-case, and we don't
   * want to enforce one rule on a column that points at the other
   * system. Length-capped to mirror the catalogue side.
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  productCategorySlug?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
