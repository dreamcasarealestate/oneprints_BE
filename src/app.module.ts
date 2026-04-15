import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './user/users.module';
import { OrdersModule } from './order/orders.module';
import { DatabaseModule } from './database/database.module';
import { BranchModule } from './branch/branch.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { DesignerModule } from './designer/designer.module';
import { NotificationsModule } from './notification/notifications.module';
import { DesignsModule } from './design/designs.module';
import { AdminModule } from './admin/admin.module';
import { AddressesModule } from './address/addresses.module';
import { ReviewsModule } from './review/reviews.module';
import { CorporateModule } from './corporate/corporate.module';
import { FavoritesModule } from './favorites/favorites.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const postgresUrl = config.get<string>('POSTGRES_URL');

        if (!postgresUrl) {
          throw new Error(
            'Missing POSTGRES_URL. Add it to .env.development or your active env file.',
          );
        }

        return {
          type: 'postgres' as const,
          url: postgresUrl,
          entities: [join(__dirname, '**', '*.entity{.ts,.js}')],
          synchronize: true,
          logging: config.get<string>('TYPEORM_LOGGING') === 'true',
        };
      },
    }),
    UsersModule,
    AuthModule,
    OrdersModule,
    DatabaseModule,
    BranchModule,
    CatalogueModule,
    DesignerModule,
    NotificationsModule,
    DesignsModule,
    FavoritesModule,
    AdminModule,
    AddressesModule,
    ReviewsModule,
    CorporateModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
