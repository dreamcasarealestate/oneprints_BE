import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './user/users.module';
import { OrdersModule } from './order/orders.module';
import { DatabaseModule } from './database/database.module';
import { User } from './user/user.entity';
import { PrintOrder } from './order/print-order.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: process.env.POSTGRES_URL,
        entities: [User, PrintOrder],
         synchronize: true,
        logging: config.get<string>('TYPEORM_LOGGING') === 'true',
      }),
    }),
    UsersModule,
    AuthModule,
    OrdersModule,
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
