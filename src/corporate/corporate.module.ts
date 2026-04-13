import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CorporateAccount } from './corporate-account.entity';
import { CorporateService } from './corporate.service';
import { CorporateController } from './corporate.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CorporateAccount])],
  controllers: [CorporateController],
  providers: [CorporateService],
  exports: [CorporateService],
})
export class CorporateModule {}
