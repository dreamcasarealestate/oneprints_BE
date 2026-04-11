import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DesignersService } from './designers.service';
import { CreateDesignerJobDto } from './dto/create-designer-job.dto';
import { DesignerProofDto } from './dto/designer-proof.dto';
import { DesignerMessageDto } from './dto/designer-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';

@ApiTags('Designer jobs')
@Controller('designer-jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class DesignerJobsController {
  constructor(private readonly designers: DesignersService) {}

  @Post()
  @ApiOperation({ summary: 'Customer creates design job request' })
  create(@CurrentUser() user: User, @Body() dto: CreateDesignerJobDto) {
    return this.designers.createJob(user.id, dto);
  }

  @Put(':id/accept')
  @ApiOperation({ summary: 'Designer accepts job' })
  accept(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.designers.acceptJob(id, user.id);
  }

  @Put(':id/decline')
  @ApiOperation({ summary: 'Designer declines job' })
  decline(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.designers.declineJob(id, user.id);
  }

  @Post(':id/proofs')
  @ApiOperation({ summary: 'Designer uploads proof asset URL' })
  @ApiBody({ type: DesignerProofDto })
  addProof(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DesignerProofDto,
  ) {
    return this.designers.addProof(id, user.id, dto);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Customer approves final proof / completes job' })
  approve(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.designers.approveJob(id, user.id);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'List thread messages' })
  messages(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.designers.listMessages(id, user.id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send message in job thread' })
  @ApiBody({ type: DesignerMessageDto })
  postMessage(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DesignerMessageDto,
  ) {
    return this.designers.postMessage(id, user.id, dto);
  }
}
