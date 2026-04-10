import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'customer@oneprint.com',
    description: 'Account email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'StrongPass123',
    minLength: 8,
    description: 'Account password',
  })
  @IsString()
  @MinLength(8)
  password: string;
}
