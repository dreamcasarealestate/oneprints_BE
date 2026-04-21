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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../user/user.entity';
import {
  CreateProductTemplateDto,
  UpdateProductTemplateDto,
} from './dto/product-template.dto';
import { ProductTemplatesService } from './product-templates.service';

@ApiTags('Product Templates')
@Controller('product-templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ProductTemplatesController {
  constructor(private readonly templatesService: ProductTemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Save a reusable product template for a category' })
  create(@CurrentUser() user: User, @Body() dto: CreateProductTemplateDto) {
    return this.templatesService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List saved product templates (optionally filtered by productType)' })
  findAll(
    @CurrentUser() user: User,
    @Query('productType') productType?: string,
  ) {
    return this.templatesService.findAllByUser(user.id, productType);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.templatesService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateProductTemplateDto,
  ) {
    return this.templatesService.update(id, user.id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.templatesService.remove(id, user.id);
    return { message: 'Template deleted successfully' };
  }
}
