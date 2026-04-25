import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ANALYTICS_ROLES,
  AUDIT_VIEW_ROLES,
  CATALOGUE_ADMIN_ROLES,
  CATALOGUE_PRODUCT_EDITOR_ROLES,
  DESIGNER_APPROVAL_ROLES,
  DESIGNER_VIEW_ROLES,
  PAYOUT_ADMIN_ROLES,
} from '../user/roles.util';
import { AdminService } from './admin.service';
import { CatalogueService } from '../catalogue/catalogue.service';
import { RejectDesignerDto } from '../designer/dto/reject-designer.dto';
import { ApplyDesignerDto } from '../designer/dto/apply-designer.dto';
import { BulkImportProductsDto } from './dto/bulk-import-products.dto';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { User } from '../user/user.entity';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly catalogue: CatalogueService,
  ) {}

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

  @Get('designers')
  @Roles(...DESIGNER_VIEW_ROLES)
  @ApiOperation({ summary: 'List designer profiles for admin management' })
  designers(
    @Query('search') search?: string,
    @Query('specialization') specialization?: string,
    @Query('rateType') rateType?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listDesigners({
      search,
      specialization,
      rateType: rateType as any,
      status: status as any,
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
    });
  }

  @Put('designers/:id/approve')
  @Roles(...DESIGNER_APPROVAL_ROLES)
  @ApiOperation({ summary: 'Approve designer application' })
  approveDesigner(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.admin.approveDesignerWithActor(id, user);
  }

  @Put('designers/:id/reject')
  @Roles(...DESIGNER_APPROVAL_ROLES)
  @ApiOperation({ summary: 'Reject designer application' })
  @ApiBody({ type: RejectDesignerDto })
  rejectDesigner(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectDesignerDto,
  ) {
    return this.admin.rejectDesigner(id, dto, user);
  }

  @Patch('designers/:id/activate')
  @Roles(...DESIGNER_APPROVAL_ROLES)
  @ApiOperation({ summary: 'Activate / approve designer profile' })
  activateDesigner(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.admin.setDesignerStatus(id, 'approved', user);
  }

  @Patch('designers/:id/deactivate')
  @Roles(...DESIGNER_APPROVAL_ROLES)
  @ApiOperation({ summary: 'Deactivate / suspend designer profile' })
  deactivateDesigner(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.admin.setDesignerStatus(id, 'suspended', user);
  }

  @Delete('designers/:id')
  @Roles(...DESIGNER_APPROVAL_ROLES)
  @ApiOperation({ summary: 'Delete designer profile' })
  deleteDesigner(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.deleteDesigner(id);
  }

  @Post('designers/apply')
  @Roles(...DESIGNER_APPROVAL_ROLES)
  @ApiOperation({
    summary:
      'Submit designer application on behalf (same payload as public apply)',
  })
  @ApiBody({ type: ApplyDesignerDto })
  adminApplyDesigner(
    @CurrentUser() user: User,
    @Body() dto: ApplyDesignerDto,
  ) {
    return this.admin.adminSubmitDesignerApplication(dto, user);
  }

  @Post('products/bulk-import')
  @Roles(...CATALOGUE_ADMIN_ROLES)
  @ApiOperation({ summary: 'CSV product import (admin)' })
  @ApiBody({ type: BulkImportProductsDto })
  bulkImport(@Body() dto: BulkImportProductsDto) {
    return this.admin.bulkImportProducts(dto.csv);
  }

  @Get('catalogue/products')
  @Roles(...CATALOGUE_PRODUCT_EDITOR_ROLES)
  @ApiOperation({
    summary: 'Paginated catalogue products (admin / staff, incl. inactive)',
  })
  listCatalogueProducts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('categories') categories?: string,
    @Query('status') status?: 'all' | 'active' | 'archived',
  ) {
    const fromList = categories
      ? categories
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : [];
    const categorySlugs =
      fromList.length > 0
        ? fromList
        : category?.trim()
          ? [category.trim().toLowerCase()]
          : undefined;

    return this.catalogue.listProductsAdminPaged({
      page: page !== undefined ? Number(page) : undefined,
      limit: limit !== undefined ? Number(limit) : undefined,
      search,
      categorySlugs,
      status: status ?? 'all',
    });
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
  auditLogs(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.admin.listAuditLogs(
      limit !== undefined ? Number(limit) : undefined,
      offset !== undefined ? Number(offset) : undefined,
    );
  }
}
