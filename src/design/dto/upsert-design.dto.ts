import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpsertDesignDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  canvasState: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previewUrl?: string;
}
