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
import { S3Module } from './s3/s3.module';
import { ProductTemplatesModule } from './product-templates/product-templates.module';
import { CartModule } from './cart/cart.module';
import { TemplatesModule } from './templates/templates.module';
import { CouponsModule } from './coupon/coupons.module';
import { MailModule } from './mail/mail.module';
import { ProductionModule } from './production/production.module';

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

        const isCloudPostgres =
          /\.neon\.tech|\.amazonaws\.com|supabase\.co|azure\.com/i.test(
            postgresUrl,
          );

        return {
          type: 'postgres' as const,
          url: postgresUrl,
          entities: [join(__dirname, '**', '*.entity{.ts,.js}')],
          synchronize: true,
          logging: config.get<string>('TYPEORM_LOGGING') === 'true',
          // Initial connect (e.g. after Neon wake or brief outage)
          retryAttempts: 5,
          retryDelay: 2000,
          // Passed to node-pg Pool — reduces stale sockets after idle / suspend
          extra: {
            max: isCloudPostgres ? 8 : 10,
            idleTimeoutMillis: isCloudPostgres ? 15_000 : 30_000,
            connectionTimeoutMillis: 20_000,
            keepAlive: true,
            keepAliveInitialDelayMillis: 10_000,
            ...(isCloudPostgres ? { maxUses: 500 } : {}),
          },
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
    S3Module,
    ProductTemplatesModule,
    CartModule,
    TemplatesModule,
    CouponsModule,
    MailModule,
    ProductionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
