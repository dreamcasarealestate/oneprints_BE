import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Payload sent when a user deactivates or deletes their own account.
 * The current password is mandatory so we can re-confirm intent on the
 * server even if the access token is fresh.
 */
export class AccountActionDto {
  @ApiProperty({
    description: 'Current account password — required for confirmation.',
    example: 'CurrentPass123',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiPropertyOptional({
    description: 'Optional free-text reason captured for analytics & support.',
    example: 'Switching to a different vendor for printing.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description:
      'When deleting, must be true to acknowledge the irreversible action.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  acknowledged?: boolean;
}
