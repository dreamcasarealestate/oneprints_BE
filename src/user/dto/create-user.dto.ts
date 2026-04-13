import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { UserKind } from '../user-kind.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'Priya' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Sharma' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({
    example: 'priya.sharma',
    description: 'Optional custom username. Auto-generated when omitted.',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'priya@oneprint.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+91 9988776655' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ example: 'StrongPass123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    enum: UserKind,
    example: UserKind.USER,
    description: 'Role to assign to the new user',
  })
  @IsOptional()
  @IsEnum(UserKind)
  userKind?: UserKind;

  @ApiPropertyOptional({
    description:
      'Branch UUID. Required for super_admin / ops_head (from admin branch switcher). Ignored for branch-locked operators — their session branch is used.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
