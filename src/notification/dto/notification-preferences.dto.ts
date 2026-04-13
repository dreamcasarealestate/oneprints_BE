import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class NotificationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Notification types to suppress (e.g. order, designer_job)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mutedTypes?: string[];

  @ApiPropertyOptional({ enum: ['off', 'daily'] })
  @IsOptional()
  @IsIn(['off', 'daily'])
  emailDigest?: 'off' | 'daily';

  @ApiPropertyOptional({
    description: 'When false, in-app toasts/stream can be suppressed client-side hint',
  })
  @IsOptional()
  pushEnabled?: boolean;
}
