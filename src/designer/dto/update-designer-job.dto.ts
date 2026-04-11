import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { DesignerJobStatus } from '../designer-job.entity';

const STATUSES: DesignerJobStatus[] = [
  'accepted',
  'declined',
  'in_progress',
  'completed',
  'cancelled',
];

export class UpdateDesignerJobDto {
  @ApiProperty({ enum: STATUSES })
  @IsString()
  @IsIn(STATUSES)
  status: DesignerJobStatus;
}
