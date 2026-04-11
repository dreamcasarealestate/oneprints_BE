import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BranchesService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserKind } from '../user/user-kind.enum';

@ApiTags('Branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @ApiOperation({ summary: 'List active branches (public, for checkout UI)' })
  findActive() {
    return this.branchesService.findActivePublic();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserKind.SUPER_ADMIN, UserKind.ADMIN, UserKind.OPS_HEAD)
  @ApiOperation({ summary: 'Full branch list for operations / super admin' })
  findAllAdmin() {
    return this.branchesService.findAllForAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserKind.SUPER_ADMIN, UserKind.ADMIN)
  @ApiOperation({ summary: 'Create branch' })
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('access-token')
  @Roles(UserKind.SUPER_ADMIN, UserKind.ADMIN)
  @ApiOperation({ summary: 'Update branch' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(id, dto);
  }
}
