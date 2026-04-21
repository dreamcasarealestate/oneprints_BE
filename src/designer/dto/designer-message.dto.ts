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

  @ApiProperty({ enum: ['image', 'video', 'file'] })
  @IsIn(['image', 'video', 'file'])
  kind: 'image' | 'video' | 'file';

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
}
