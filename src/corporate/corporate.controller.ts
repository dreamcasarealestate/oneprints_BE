import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { USER_MANAGEMENT_ROLES } from '../user/roles.util';
import { CorporateService } from './corporate.service';
import { UpsertCorporateAccountDto } from './dto/upsert-corporate-account.dto';

@ApiTags('Corporate accounts')
@Controller('corporate-account')
export class CorporateController {
  constructor(private readonly corporate: CorporateService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get corporate profile for current user' })
  mine(@CurrentUser() user: User) {
    return this.corporate.getMine(user.id);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create or update corporate profile (self-service)' })
  @ApiBody({ type: UpsertCorporateAccountDto })
  upsertMine(
    @CurrentUser() user: User,
    @Body() dto: UpsertCorporateAccountDto,
  ) {
    return this.corporate.upsertMine(user.id, dto);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(...USER_MANAGEMENT_ROLES)
  @ApiOperation({ summary: 'List all corporate accounts (admin)' })
  listAdmin() {
    return this.corporate.listAll();
  }
}
