import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Designer } from './designer.entity';
import { DesignerJob } from './designer-job.entity';
import { DesignerMessage } from './designer-message.entity';
import { DesignerProof } from './designer-proof.entity';
import { DesignersService } from './designers.service';
import { DesignersController } from './designers.controller';
import { DesignerJobsController } from './designer-jobs.controller';
import { NotificationsModule } from '../notification/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Designer,
      DesignerJob,
      DesignerMessage,
      DesignerProof,
    ]),
    NotificationsModule,
  ],
  controllers: [DesignersController, DesignerJobsController],
  providers: [DesignersService],
  exports: [DesignersService, TypeOrmModule],
})
export class DesignerModule {}
