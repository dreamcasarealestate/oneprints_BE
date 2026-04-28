import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from './address.entity';
import { AddressesService } from './addresses.service';
import { AddressesController } from './addresses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Address])],
  controllers: [AddressesController],
  providers: [AddressesService],
  // Re-export the repository so feature modules (e.g. OrdersModule)
  // can inject `Repository<Address>` for cross-cutting work like
  // syncing an order's shipping address back to the user's address book.
  exports: [AddressesService, TypeOrmModule],
})
export class AddressesModule {}
