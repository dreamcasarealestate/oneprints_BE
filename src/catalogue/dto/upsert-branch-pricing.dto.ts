import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class UpsertBranchPricingDto {
  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  priceOverride: number;
}
