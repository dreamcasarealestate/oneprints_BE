import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { USER_MANAGEMENT_ROLES } from './roles.util';

@Controller('users')
@ApiTags('Users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class UserController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  // @Roles(...USER_MANAGEMENT_ROLES)
  @ApiOperation({ summary: 'Create a user (admin)' })
  @ApiBody({ type: CreateUserDto })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: User) {
    return this.usersService.createManagedUser(dto, actor);
  }

  @Get()
  @Roles(...USER_MANAGEMENT_ROLES)
  @ApiOperation({ summary: 'List users (admin)' })
  @ApiOkResponse({ description: 'Users' })
  findAll(
    @CurrentUser() actor: User,
    @Query('branchId') branchId?: string,
  ) {
    return this.usersService.findAllForActor(actor, branchId);
  }

  @Get(':id')
  @Roles(...USER_MANAGEMENT_ROLES)
  @ApiOperation({ summary: 'Get user by id' })
  @ApiParam({ name: 'id', description: 'User id (UUID)' })
  findById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: User,
  ) {
    return this.usersService.findOneOrFailForActor(id, actor);
  }

  @Patch(':id')
  @Roles(...USER_MANAGEMENT_ROLES)
  @ApiOperation({ summary: 'Update user by id' })
  @ApiParam({ name: 'id', description: 'User id (UUID)' })
  @ApiBody({ type: UpdateUserDto })
  updatePatch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: User,
  ) {
    return this.usersService.updateManagedUser(id, dto, actor);
  }

  @Put(':id')
  @Roles(...USER_MANAGEMENT_ROLES)
  @ApiOperation({ summary: 'Update user by id (PUT)' })
  @ApiParam({ name: 'id', description: 'User id (UUID)' })
  @ApiBody({ type: UpdateUserDto })
  updatePut(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: User,
  ) {
    return this.usersService.updateManagedUser(id, dto, actor);
  }

  @Delete(':id')
  // @Roles(...USER_MANAGEMENT_ROLES)
  @ApiOperation({ summary: 'Delete user by id' })
  @ApiParam({ name: 'id', description: 'User id (UUID)' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: User,
  ) {
    return this.usersService.removeManagedUser(id, actor);
  }
}
