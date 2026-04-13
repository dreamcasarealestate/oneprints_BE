import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SnoozeNotificationDto {
  @ApiPropertyOptional({
    description: 'ISO-8601 instant when the notification becomes visible again',
  })
  @IsOptional()
  @IsDateString()
  snoozedUntil?: string;

  @ApiPropertyOptional({
    description: 'Alternative: snooze for this many minutes from now (1–10080)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_080)
  snoozeMinutes?: number;
}
