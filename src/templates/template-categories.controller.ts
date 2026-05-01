import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TemplateCategoriesService } from './template-categories.service';
import { CreateTemplateCategoryDto } from './dto/create-template-category.dto';
import { UpdateTemplateCategoryDto } from './dto/update-template-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CATALOGUE_ADMIN_ROLES } from '../user/roles.util';

@Controller('template-categories')
export class TemplateCategoriesController {
  constructor(private readonly svc: TemplateCategoriesService) {}

  @Public()
  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.svc.list({ activeOnly: includeInactive !== 'true' });
  }

  @Public()
  @Get(':slug')
  getOne(@Param('slug') slug: string) {
    return this.svc.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Post()
  create(@Body() dto: CreateTemplateCategoryDto) {
    return this.svc.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTemplateCategoryDto) {
    return this.svc.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
