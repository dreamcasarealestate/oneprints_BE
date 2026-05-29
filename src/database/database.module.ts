import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { DatabaseKeepAliveService } from './database-keepalive.service';
import { UsersModule } from '../user/users.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [UsersModule, CatalogueModule, TemplatesModule],
  // `DatabaseKeepAliveService` fires a periodic `SELECT 1` to stop
  // serverless Postgres providers (Neon, Supabase free) from
  // suspending the compute node — see its docstring for the full
  // story. It's intentionally provided here (and not exported)
  // because nothing else needs to talk to it; it just runs in the
  // background once the module boots.
  providers: [SeedService, DatabaseKeepAliveService],
})
export class DatabaseModule {}
