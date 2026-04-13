import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'When provided, that refresh session is invalidated',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
