import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * Fields a signed-in user is allowed to change on their own profile.
 * Does NOT include userKind, roleId, or branchId – those are admin-only.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Priya' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @ApiPropertyOptional({ example: 'priya.sharma' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'priya@oneprint.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+91 9988776655' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/)
  phoneNumber?: string;

  @ApiPropertyOptional({
    description:
      'Public S3 URL of the uploaded profile image. Pass null/empty string to clear.',
    example:
      'https://oneprints-bucket.s3.ap-south-1.amazonaws.com/profile/1713-avatar.png',
  })
  @IsOptional()
  @IsString()
  profileImage?: string | null;

  @ApiPropertyOptional({
    example: 'NewStrongPass123',
    minLength: 8,
    description: 'Set a new password (min 8 characters)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    example: 'OldPass123',
    description: 'Current password — required when changing password or email',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;
}
