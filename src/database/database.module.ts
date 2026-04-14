import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { UsersModule } from '../user/users.module';
import { CatalogueModule } from '../catalogue/catalogue.module';

@Module({
  imports: [UsersModule, CatalogueModule],
  providers: [SeedService],
})
export class DatabaseModule {}
