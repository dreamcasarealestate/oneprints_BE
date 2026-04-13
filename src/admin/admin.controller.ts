import {
  Body,
  Controller,
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
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ANALYTICS_ROLES,
  AUDIT_VIEW_ROLES,
  CATALOGUE_ADMIN_ROLES,
  DESIGNER_APPROVAL_ROLES,
  DESIGNER_VIEW_ROLES,
  PAYOUT_ADMIN_ROLES,
} from '../user/roles.util';
import { AdminService } from './admin.service';
import { RejectDesignerDto } from '../designer/dto/reject-designer.dto';
import { ApplyDesignerDto } from '../designer/dto/apply-designer.dto';
import { BulkImportProductsDto } from './dto/bulk-import-products.dto';
import { CreatePayoutDto } from './dto/create-payout.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('analytics')
  @Roles(...ANALYTICS_ROLES)
  @ApiOperation({ summary: 'Global analytics (ops head + super admin)' })
  analytics() {
    return this.admin.analytics();
  }

  @Get('designers/pending')
  @Roles(...DESIGNER_VIEW_ROLES)
  @ApiOperation({ summary: 'Pending designer applications (view)' })
  pendingDesigners() {
    return this.admin.pendingDesigners();
  }

  @Put('designers/:id/approve')
  @Roles(...DESIGNER_APPROVAL_ROLES)
  @ApiOperation({ summary: 'Approve designer application' })
  approveDesigner(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.approveDesigner(id);
  }

  @Put('designers/:id/reject')
  @Roles(...DESIGNER_APPROVAL_ROLES)
  @ApiOperation({ summary: 'Reject designer application' })
  @ApiBody({ type: RejectDesignerDto })
  rejectDesigner(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectDesignerDto,
  ) {
    return this.admin.rejectDesigner(id, dto);
  }

  @Post('designers/apply')
  @Roles(...DESIGNER_APPROVAL_ROLES)
  @ApiOperation({
    summary: 'Submit designer application on behalf (same payload as public apply)',
  })
  @ApiBody({ type: ApplyDesignerDto })
  adminApplyDesigner(@Body() dto: ApplyDesignerDto) {
    return this.admin.adminSubmitDesignerApplication(dto);
  }

  @Post('products/bulk-import')
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @ApiOperation({ summary: 'CSV product import (admin)' })
  @ApiBody({ type: BulkImportProductsDto })
  bulkImport(@Body() dto: BulkImportProductsDto) {
    return this.admin.bulkImportProducts(dto.csv);
  }

  @Get('payouts')
  @Roles(...PAYOUT_ADMIN_ROLES)
  @ApiOperation({ summary: 'List designer payouts' })
  listPayouts() {
    return this.admin.listPayouts();
  }

  @Post('payouts')
  @Roles(...PAYOUT_ADMIN_ROLES)
  @ApiOperation({ summary: 'Record a payout row' })
  @ApiBody({ type: CreatePayoutDto })
  createPayout(@Body() dto: CreatePayoutDto) {
    return this.admin.createPayout(dto);
  }

  @Get('audit-logs')
  @Roles(...AUDIT_VIEW_ROLES)
  @ApiOperation({ summary: 'Append-only admin/staff audit trail (paginated)' })
  auditLogs(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.admin.listAuditLogs(
      limit !== undefined ? Number(limit) : undefined,
      offset !== undefined ? Number(offset) : undefined,
    );
  }
}
