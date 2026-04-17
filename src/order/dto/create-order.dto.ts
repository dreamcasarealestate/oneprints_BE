import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ShippingAddressInputDto {
  @ApiProperty()
  @IsString()
  fullName: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  email: string;

  @ApiProperty()
  @IsString()
  addressLine1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  state: string;

  @ApiProperty()
  @IsString()
  country: string;

  @ApiProperty()
  @IsString()
  pinCode: string;
}

export class OrderLineItemInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  productName: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: 'Original product display image URL for the selected colour.' })
  @IsOptional()
  @IsString()
  productImage?: string;

  @ApiPropertyOptional({ description: 'User customized design thumbnail URL (canvas export).' })
  @IsOptional()
  @IsString()
  customizedImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  designData?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  measurements?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customizationData?: Record<string, unknown>;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ example: 'apparel' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  productCategory?: string;

  @ApiProperty({
    example: 'Corporate tees — front + back print',
  })
  @IsString()
  @MinLength(4)
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designNotes?: string;

  @ApiPropertyOptional({ type: [OrderLineItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineItemInputDto)
  items?: OrderLineItemInputDto[];

  @ApiPropertyOptional({ type: ShippingAddressInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressInputDto)
  shippingAddress?: ShippingAddressInputDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pinCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  designerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  designerFee?: number;

  @ApiPropertyOptional({ enum: ['cod', 'razorpay', 'credit'] })
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  gstAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;
}
