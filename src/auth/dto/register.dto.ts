import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { UserKind } from '../../user/user-kind.enum';

export class RegisterDto {
  @ApiProperty({ example: 'Aarav', minLength: 2 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  firstName: string;

  @ApiProperty({ example: 'Patel' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'aarav@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '+91 9876543210',
    description: 'Phone number for order updates',
  })
  @IsString()
  @Matches(/^[0-9+\-\s()]{7,20}$/)
  phoneNumber: string;

  @ApiProperty({ example: 'StrongPass123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    enum: UserKind,
    example: UserKind.USER,
    description: 'Self-registration always creates a customer account',
  })
  @IsOptional()
  @IsEnum(UserKind)
  userKind?: UserKind;
}
