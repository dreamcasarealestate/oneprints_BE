import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GenerateUploadUrlDto {
  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiProperty()
  @IsString()
  fileType: string;
}

export class DeleteFileDto {
  @ApiProperty()
  @IsString()
  fileName: string;
}
