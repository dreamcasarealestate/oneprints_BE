import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { UserKind } from '../user-kind.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Priya' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional()
  @IsString()
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
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'StrongPass123', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    enum: UserKind,
    example: UserKind.STAFF,
  })
  @IsOptional()
  @IsEnum(UserKind)
  userKind?: UserKind;

  @ApiPropertyOptional({
    description:
      'Reassign branch (super_admin / ops_head only). Set null to clear.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string | null;
}
