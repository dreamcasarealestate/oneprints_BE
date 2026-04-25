import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserController } from './user.controller';
import { User } from './user.entity';
import { Role } from './role.entity';
import { UsersService } from './users.service';
import { UserSchemaBootstrapService } from './user-schema-bootstrap.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    forwardRef(() => AuthModule),
  ],
  controllers: [UserController],
  providers: [UsersService, UserSchemaBootstrapService],
  exports: [UsersService],
})
export class UsersModule {}
