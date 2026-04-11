import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { UserKind } from '../user/user-kind.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { DispatchOrderDto } from './dto/dispatch-order.dto';
import { OrderReturnDto } from './dto/order-action.dto';

@Controller('orders')
@ApiTags('Orders')
@ApiBearerAuth('access-token')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Place a new order' })
  @ApiBody({ type: CreateOrderDto })
  create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.ordersService.createForUser(user.id, dto);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List orders for the current customer' })
  @ApiOkResponse({ description: 'Customer orders' })
  mine(@CurrentUser() user: User) {
    return this.ordersService.findMine(user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserKind.ADMIN,
    UserKind.SUPER_ADMIN,
    UserKind.OPS_HEAD,
    UserKind.BRANCH_MANAGER,
    UserKind.STAFF,
  )
  @ApiOperation({ summary: 'List orders (scoped by branch for branch managers)' })
  @ApiOkResponse({ description: 'Orders for operations' })
  findAll(@CurrentUser() user: User) {
    return this.ordersService.findAllForStaff(user);
  }

  @Get(':id/invoice')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Invoice metadata (PDF URL when integrated)' })
  invoice(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    const isStaff = [
      UserKind.ADMIN,
      UserKind.SUPER_ADMIN,
      UserKind.OPS_HEAD,
      UserKind.BRANCH_MANAGER,
      UserKind.STAFF,
    ].includes(user.userKind as UserKind);
    return this.ordersService.invoiceStub(
      id,
      isStaff ? null : user.id,
      isStaff ? user : null,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Order detail with timeline' })
  @ApiParam({ name: 'id', description: 'Order id (UUID)' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    const isStaff = [
      UserKind.ADMIN,
      UserKind.SUPER_ADMIN,
      UserKind.OPS_HEAD,
      UserKind.BRANCH_MANAGER,
      UserKind.STAFF,
    ].includes(user.userKind as UserKind);
    return this.ordersService.findOneForUser(
      id,
      isStaff ? null : user.id,
      isStaff ? user : null,
    );
  }

  @Put(':id/status')
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserKind.ADMIN,
    UserKind.SUPER_ADMIN,
    UserKind.OPS_HEAD,
    UserKind.BRANCH_MANAGER,
    UserKind.STAFF,
  )
  @ApiOperation({ summary: 'Update order status (staff+)' })
  @ApiParam({ name: 'id', description: 'Order id (UUID)' })
  @ApiBody({ type: UpdateOrderStatusDto })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.updateStatus(id, dto, user);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Customer cancels order' })
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.cancel(id, user.id);
  }

  @Post(':id/return')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Customer requests return' })
  requestReturn(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
    @Body() dto: OrderReturnDto,
  ) {
    return this.ordersService.requestReturn(id, user.id, dto.reason);
  }

  @Post(':id/dispatch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserKind.ADMIN,
    UserKind.SUPER_ADMIN,
    UserKind.OPS_HEAD,
    UserKind.BRANCH_MANAGER,
    UserKind.STAFF,
  )
  @ApiOperation({ summary: 'Mark dispatched with tracking' })
  @ApiBody({ type: DispatchOrderDto })
  dispatch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DispatchOrderDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.dispatch(id, dto, user);
  }
}
