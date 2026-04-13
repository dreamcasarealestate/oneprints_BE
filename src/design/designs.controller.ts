import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DesignsService } from './designs.service';
import { UpsertDesignDto } from './dto/upsert-design.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';

@ApiTags('Designs')
@Controller('designs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class DesignsController {
  constructor(private readonly designs: DesignsService) {}

  @Post()
  @ApiOperation({ summary: 'Save or update design canvas JSON' })
  @ApiBody({ type: UpsertDesignDto })
  upsert(@CurrentUser() user: User, @Body() dto: UpsertDesignDto) {
    return this.designs.upsert(user.id, dto);
  }

  @Post('remove-background')
  @ApiOperation({ summary: 'AI background removal on uploaded image (stub)' })
  removeBackground() {
    return this.designs.removeBackgroundStub();
  }

  @Get()
  @ApiOperation({ summary: 'List saved designs for current user' })
  list(@CurrentUser() user: User) {
    return this.designs.listMine(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Load design (JSON + preview URL)' })
  getOne(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.designs.getOne(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete saved design' })
  remove(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.designs.remove(user.id, id);
  }

  @Post(':id/export-pdf')
  @ApiOperation({ summary: 'Trigger print-ready PDF generation (stub)' })
  exportPdf(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.designs.exportPdfStub(id, user.id);
  }
}
