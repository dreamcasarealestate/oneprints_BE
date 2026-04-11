import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogueService } from './catalogue.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserKind } from '../user/user-kind.enum';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @ApiOperation({ summary: 'List active products (public)' })
  list(
    @Query('category') categorySlug?: string,
    @Query('search') search?: string,
  ) {
    return this.catalogue.listProducts({ categorySlug, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Product detail (public)' })
  getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogue.getProduct(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserKind.SUPER_ADMIN, UserKind.ADMIN)
  @ApiOperation({ summary: 'Create product (admin)' })
  create(@Body() dto: CreateProductDto) {
    return this.catalogue.createProduct(dto);
  }
}
