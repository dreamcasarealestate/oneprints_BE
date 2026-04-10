import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({
    example: 'drinkware',
    description: 'Product category selected by the customer',
  })
  @IsString()
  @MinLength(2)
  productCategory: string;

  @ApiProperty({
    example: '500 white water bottles with front logo and individual names',
  })
  @IsString()
  @MinLength(4)
  description: string;

  @ApiPropertyOptional({
    example: 'Use matte finish and place logo center aligned',
  })
  @IsOptional()
  @IsString()
  designNotes?: string;
}
