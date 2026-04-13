import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DesignersService } from './designers.service';
import { ApplyDesignerDto } from './dto/apply-designer.dto';
import { UpdateDesignerProfileDto } from './dto/update-designer-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';

@ApiTags('Designers')
@Controller('designers')
export class DesignersController {
  constructor(private readonly designers: DesignersService) {}

  @Post('apply')
  @ApiOperation({ summary: 'Designer submits application (public)' })
  apply(@Body() dto: ApplyDesignerDto) {
    return this.designers.apply(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List approved designers' })
  list(
    @Query('search') search?: string,
    @Query('specialization') specialization?: string,
  ) {
    return this.designers.listApproved(search, specialization);
  }

  @Get('onboarding/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Designer onboarding: linked profile or latest application for your email',
  })
  onboardingMe(@CurrentUser() user: User) {
    return this.designers.getOnboardingContextForUser(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Designer profile' })
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const d = await this.designers.getPublic(id);
    if (!d) throw new NotFoundException('Designer not found');
    return d;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update own designer profile (linked user only)' })
  updateProfile(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateDesignerProfileDto,
  ) {
    return this.designers.updateOwnProfile(user, id, dto);
  }
}
