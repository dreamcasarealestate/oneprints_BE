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
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CATALOGUE_ADMIN_ROLES } from '../user/roles.util';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly svc: TemplatesService) {}

  @Public()
  @Get()
  list(
    @Query('categorySlug') categorySlug?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.list({
      categorySlug,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Get('all')
  listAll() {
    return this.svc.listAll();
  }

  @Public()
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.svc.getOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.svc.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateTemplateDto>) {
    return this.svc.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
