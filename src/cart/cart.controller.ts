import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { SyncCartDto } from './dto/sync-cart.dto';
import { UpdateCartMetaDto } from './dto/update-cart-meta.dto';

/**
 * Per-user shopping cart endpoints. Authenticated users always
 * resolve their own cart from the JWT — the cart row is keyed by
 * `userId` so it survives across devices and browser sessions
 * automatically.
 */
@ApiTags('Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: "Get the signed-in user's cart" })
  getMyCart(@CurrentUser() user: User) {
    return this.cartService.getOrCreateCart(user.id);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add an item to the cart' })
  @ApiBody({ type: AddToCartDto })
  addItem(@CurrentUser() user: User, @Body() dto: AddToCartDto) {
    return this.cartService.addItem(user.id, dto);
  }

  @Patch('items/:itemId')
  @ApiOperation({
    summary: 'Update a cart item (quantity, customisation, snapshot, …)',
  })
  @ApiBody({ type: UpdateCartItemDto })
  updateItem(
    @CurrentUser() user: User,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(user.id, itemId, dto);
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove a single item from the cart' })
  removeItem(
    @CurrentUser() user: User,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ) {
    return this.cartService.removeItem(user.id, itemId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear all items from the cart' })
  clear(@CurrentUser() user: User) {
    return this.cartService.clear(user.id);
  }

  @Patch('sync')
  @ApiOperation({
    summary:
      'Replace the cart with the provided snapshot (used to merge a guest cart on login).',
  })
  @ApiBody({ type: SyncCartDto })
  sync(@CurrentUser() user: User, @Body() dto: SyncCartDto) {
    return this.cartService.sync(user.id, dto);
  }

  @Patch('meta')
  @ApiOperation({
    summary: 'Update cart-level metadata (coupon, currency, addresses).',
  })
  @ApiBody({ type: UpdateCartMetaDto })
  updateMeta(@CurrentUser() user: User, @Body() dto: UpdateCartMetaDto) {
    return this.cartService.updateMeta(user.id, dto);
  }
}
