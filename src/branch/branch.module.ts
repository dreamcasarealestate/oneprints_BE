import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from './branch.entity';
import { BranchesService } from './branch.service';
import { BranchesController } from './branch.controller';
import { PincodeGeoService } from './pincode-geo.service';

@Module({
  imports: [TypeOrmModule.forFeature([Branch])],
  controllers: [BranchesController],
  providers: [BranchesService, PincodeGeoService],
  exports: [BranchesService, PincodeGeoService, TypeOrmModule],
})
export class BranchModule {}
