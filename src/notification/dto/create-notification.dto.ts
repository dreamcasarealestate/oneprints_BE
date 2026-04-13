import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'order_status' })
  @IsString()
  @MaxLength(64)
  type: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ['low', 'normal', 'high'] })
  @IsOptional()
  @IsIn(['low', 'normal', 'high'])
  priority?: 'low' | 'normal' | 'high';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  actionUrl?: string;

  @ApiPropertyOptional({ example: 'in_app' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  channel?: string;

  @ApiPropertyOptional({
    description: 'Skip creating if same user had this key in the last 24h',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  dedupeKey?: string;
}
