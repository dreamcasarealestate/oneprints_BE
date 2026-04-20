import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CatalogueService } from './catalogue.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CATALOGUE_PRODUCT_EDITOR_ROLES } from '../user/roles.util';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @ApiOperation({ summary: 'List active products (public)' })
  list(
    @Query('category') categorySlug?: string,
    @Query('search') search?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = limitRaw ? Math.floor(Number(limitRaw)) : undefined;
    return this.catalogue.listProducts({ categorySlug, search, limit });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Product detail with print areas (public)' })
  getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogue.getProduct(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_PRODUCT_EDITOR_ROLES)
  @ApiOperation({ summary: 'Create product (admin / staff)' })
  create(@Body() dto: CreateProductDto, @CurrentUser() user: User) {
    return this.catalogue.createProduct(dto, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_PRODUCT_EDITOR_ROLES)
  @ApiOperation({ summary: 'Partially update product (admin / staff)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: User,
  ) {
    return this.catalogue.updateProduct(id, dto, user);
  }

  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_PRODUCT_EDITOR_ROLES)
  @ApiOperation({ summary: 'Restore archived product to storefront (admin / staff)' })
  restore(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.catalogue.restoreProduct(id, user);
  }

  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_PRODUCT_EDITOR_ROLES)
  @ApiOperation({
    summary: 'Permanently delete product (admin / staff)',
    description:
      'Irreversible. Clears product link on saved designs and designer jobs; order items keep line text with product reference nulled.',
  })
  permanentDelete(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.catalogue.deleteProductPermanent(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_PRODUCT_EDITOR_ROLES)
  @ApiOperation({ summary: 'Archive product (admin / staff)' })
  archive(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: User) {
    return this.catalogue.archiveProduct(id, user);
  }
}
