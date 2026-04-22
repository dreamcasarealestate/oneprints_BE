import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class DesignerMessageAttachmentDto {
  @ApiProperty()
  @IsString()
  url: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  mime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;

  @ApiPropertyOptional({
    description:
      'For audio/video recordings, duration in seconds (client-supplied).',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;

  @ApiProperty({ enum: ['image', 'video', 'audio', 'file'] })
  @IsIn(['image', 'video', 'audio', 'file'])
  kind: 'image' | 'video' | 'audio' | 'file';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}

export class DesignerMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @ValidateIf(
    (o: DesignerMessageDto) => !o.attachments || o.attachments.length === 0,
  )
  body?: string;

  @ApiPropertyOptional({ type: [DesignerMessageAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DesignerMessageAttachmentDto)
  attachments?: DesignerMessageAttachmentDto[];

  /** When set, this message is a quoted reply to another message. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  replyToMessageId?: string;
}
