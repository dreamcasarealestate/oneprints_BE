import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogueService } from './catalogue.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserKind } from '../user/user-kind.enum';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  @ApiOperation({ summary: 'List categories (public)' })
  list() {
    return this.catalogue.listCategories();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserKind.SUPER_ADMIN, UserKind.ADMIN)
  @ApiOperation({ summary: 'Create category (admin)' })
  create(@Body() dto: CreateCategoryDto) {
    return this.catalogue.createCategory(dto);
  }
}
