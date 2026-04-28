import {
  Body,
  Controller,
  ForbiddenException,
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
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { UserKind } from '../user/user-kind.enum';
import {
  isOrderCustomerRole,
  isStaffOperationRole,
  STAFF_OPERATION_ROLES,
} from '../user/roles.util';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { DispatchOrderDto } from './dto/dispatch-order.dto';
import { OrderReturnDto } from './dto/order-action.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdateOrderShippingAddressDto } from './dto/update-shipping-address.dto';

@Controller('orders')
@ApiTags('Orders')
@ApiBearerAuth('access-token')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Place a new order' })
  @ApiBody({ type: CreateOrderDto })
  create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.ordersService.createForUser(user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List orders (scoped by role)' })
  @ApiOkResponse({ description: 'Customer: own orders; staff: branch/global' })
  findAll(@CurrentUser() user: User) {
    if (isOrderCustomerRole(user.userKind as UserKind)) {
      return this.ordersService.findMine(user.id);
    }
    if (isStaffOperationRole(user.userKind as UserKind)) {
      return this.ordersService.findAllForStaff(user);
    }
    throw new ForbiddenException();
  }

  @Get(':id/invoice')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Invoice PDF metadata / download URL when wired' })
  invoice(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    const isStaff = isStaffOperationRole(user.userKind as UserKind);
    return this.ordersService.invoiceStub(
      id,
      isStaff ? null : user.id,
      isStaff ? user : null,
    );
  }

  @Get(':id/payments')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Payment rows for an order (Razorpay refs, etc.)' })
  listPayments(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    const isStaff = isStaffOperationRole(user.userKind as UserKind);
    return this.paymentsService.listForOrder(
      id,
      isStaff ? null : user.id,
      isStaff ? user : null,
    );
  }

  @Post(':id/payments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_OPERATION_ROLES)
  @ApiOperation({ summary: 'Record a payment against an order (staff)' })
  @ApiBody({ type: CreatePaymentDto })
  recordPayment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.record(id, dto, null, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Order detail with timeline' })
  @ApiParam({ name: 'id', description: 'Order id (UUID)' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    const isStaff = isStaffOperationRole(user.userKind as UserKind);
    return this.ordersService.findOneForUser(
      id,
      isStaff ? null : user.id,
      isStaff ? user : null,
    );
  }

  @Put(':id/status')
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...STAFF_OPERATION_ROLES)
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
  @Roles(...STAFF_OPERATION_ROLES)
  @ApiOperation({ summary: 'Mark dispatched with tracking ID' })
  @ApiBody({ type: DispatchOrderDto })
  dispatch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DispatchOrderDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.dispatch(id, dto, user);
  }

  @Patch(':id/shipping-address')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      "Customer updates the shipping address on their own order. Blocked once the order has progressed past 'design_pending' — see service for the canonical gate.",
  })
  @ApiParam({ name: 'id', description: 'Order id (UUID)' })
  @ApiBody({ type: UpdateOrderShippingAddressDto })
  updateShippingAddress(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrderShippingAddressDto,
    @CurrentUser() user: User,
  ) {
    return this.ordersService.updateShippingAddress(id, user.id, dto);
  }
}
