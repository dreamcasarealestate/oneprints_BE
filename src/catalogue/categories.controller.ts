import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CatalogueService } from './catalogue.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CATALOGUE_ADMIN_ROLES } from '../user/roles.util';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @ApiOperation({ summary: 'List categories and sub-categories (public)' })
  list() {
    return this.catalogue.listCategories();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @ApiOperation({ summary: 'Create category (admin)' })
  create(@Body() dto: CreateCategoryDto) {
    return this.catalogue.createCategory(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @ApiOperation({ summary: 'Update category (admin)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalogue.updateCategory(id, dto);
  }
}
