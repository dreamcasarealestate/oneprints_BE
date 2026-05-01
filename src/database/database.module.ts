import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { UsersModule } from '../user/users.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [UsersModule, CatalogueModule, TemplatesModule],
  providers: [SeedService],
})
export class DatabaseModule {}
