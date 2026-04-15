import {
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../user/user.entity';
import { ToggleFavoriteDto } from './dto/toggle-favorite.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('Favorites')
@Controller('favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post('toggle')
  @ApiOperation({ summary: 'Toggle current user favourite record' })
  @ApiBody({ type: ToggleFavoriteDto })
  toggle(@CurrentUser() user: User, @Body() dto: ToggleFavoriteDto) {
    return this.favorites.toggle(user.id, dto);
  }

  @Get('check')
  @ApiOperation({ summary: 'Check whether a favourite exists for the current user' })
  check(@CurrentUser() user: User, @Query('resourceKey') resourceKey: string) {
    return this.favorites.check(user.id, resourceKey);
  }

  @Get()
  @ApiOperation({ summary: 'List favourites for the current user' })
  list(
    @CurrentUser() user: User,
    @Query('resourceType') resourceType?: string,
  ) {
    return this.favorites.listMine(user.id, resourceType);
  }

  @Delete()
  @ApiOperation({ summary: 'Remove a favourite by resource key' })
  remove(@CurrentUser() user: User, @Query('resourceKey') resourceKey: string) {
    return this.favorites.removeByKey(user.id, resourceKey);
  }
}
