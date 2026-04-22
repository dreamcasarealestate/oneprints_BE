import {
  Body,
  Controller,
  Delete,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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

  @Get()
  @ApiOperation({
    summary:
      'List jobs for the current user (customer sees their requests, linked designers see jobs assigned to them)',
  })
  @ApiQuery({ name: 'status', required: false })
  listMine(@CurrentUser() user: User, @Query('status') status?: string) {
    return this.designers.listMyJobs(user.id, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single job (either participant)' })
  getOne(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.designers.getJobForUser(id, user.id);
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

  @Post(':id/messages/read')
  @ApiOperation({
    summary:
      'Mark all unread messages in this thread (sent by the other party) as read',
  })
  markRead(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.designers.markMessagesRead(id, user.id);
  }

  @Post(':id/typing')
  @ApiOperation({
    summary:
      'Notify the other participant that the current user is typing (ephemeral, not persisted)',
  })
  typing(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.designers.emitTyping(id, user.id);
  }

  @Delete(':id/messages/:msgId')
  @ApiOperation({
    summary: 'Soft-delete one of my messages (WhatsApp-style "Delete for everyone")',
  })
  deleteMessage(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('msgId', new ParseUUIDPipe()) msgId: string,
  ) {
    return this.designers.deleteMessage(id, user.id, msgId);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Delete this conversation from my inbox (does not affect the other participant; auto-restores when a new message arrives)',
  })
  hideConversation(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.designers.hideConversation(id, user.id);
  }

  @Delete(':id/messages')
  @ApiOperation({
    summary:
      'Clear all messages in this conversation for both participants (keeps the job record)',
  })
  clearConversation(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.designers.clearConversation(id, user.id);
  }
}
