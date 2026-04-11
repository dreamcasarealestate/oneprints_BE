import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class DesignerProofDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  fileUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  revisionRound?: number;
}
