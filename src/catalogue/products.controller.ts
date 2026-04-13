import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { UpsertBranchPricingDto } from './dto/upsert-branch-pricing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CATALOGUE_ADMIN_ROLES } from '../user/roles.util';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @ApiOperation({ summary: 'List active products (public)' })
  list(
    @Query('category') categorySlug?: string,
    @Query('search') search?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.catalogue.listProducts({ categorySlug, search, branchId });
  }

  @Get(':id/branch-pricing')
  @ApiOperation({
    summary: 'Branch-level price overrides for a product (public)',
  })
  branchPricing(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogue.listBranchPricing(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Product detail with print areas (public)' })
  getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogue.getProduct(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @ApiOperation({ summary: 'Create product (admin)' })
  create(@Body() dto: CreateProductDto) {
    return this.catalogue.createProduct(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @ApiOperation({ summary: 'Update product (admin)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.catalogue.updateProduct(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @ApiOperation({ summary: 'Archive product (admin)' })
  archive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalogue.archiveProduct(id);
  }

  @Put(':id/branch-pricing')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @ApiOperation({ summary: 'Upsert branch price override (admin)' })
  upsertBranchPricing(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Body() dto: UpsertBranchPricingDto,
  ) {
    return this.catalogue.upsertBranchPricing(
      productId,
      dto.branchId,
      dto.priceOverride,
    );
  }

  @Delete(':id/branch-pricing/:branchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @ApiOperation({ summary: 'Remove branch price override (admin)' })
  deleteBranchPricing(
    @Param('id', new ParseUUIDPipe()) productId: string,
    @Param('branchId', new ParseUUIDPipe()) branchId: string,
  ) {
    return this.catalogue.deleteBranchPricing(productId, branchId);
  }
}
