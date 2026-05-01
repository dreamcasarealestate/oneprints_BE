import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CATALOGUE_ADMIN_ROLES } from '../user/roles.util';
import { TEMPLATE_STATUSES, type TemplateStatus } from './template.entity';

function parseStatuses(raw?: string): TemplateStatus[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as TemplateStatus[];
  const valid = parts.filter((s) => TEMPLATE_STATUSES.includes(s));
  return valid.length ? valid : undefined;
}

@Controller('templates')
export class TemplatesController {
  constructor(private readonly svc: TemplatesService) {}

  @Public()
  @Get()
  list(
    @Query('categorySlug') categorySlug?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('featured') featured?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.list({
      categorySlug,
      categoryId,
      search,
      featured:
        featured === 'true' ? true : featured === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Get('all')
  listAll(
    @Query('statuses') statuses?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsed = parseStatuses(statuses);
    if (!parsed && !search && !categoryId) {
      return this.svc.listAll();
    }
    return this.svc.list({
      includePrivate: true,
      statuses: parsed,
      search,
      categoryId,
      limit: limit ? parseInt(limit, 10) : 200,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Public()
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.svc.getOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Post()
  create(@Body() dto: CreateTemplateDto, @Req() req: Request) {
    const userId = (req.user as { id?: string } | undefined)?.id ?? '';
    return this.svc.create(dto, { id: userId });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @Patch(':id/featured')
  setFeatured(@Param('id') id: string, @Body() body: { featured: boolean }) {
    return this.svc.setFeatured(id, !!body.featured);
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
