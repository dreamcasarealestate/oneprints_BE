import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BulkImportProductsDto {
  @ApiProperty({
    description:
      'CSV with header: sku,name,categoryId,basePrice (UUID category, numeric price)',
  })
  @IsString()
  @IsNotEmpty()
  csv: string;
}
