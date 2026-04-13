import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { STAFF_OPERATION_ROLES } from '../user/roles.util';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MarkReadBatchDto } from './dto/mark-read-batch.dto';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import { SnoozeNotificationDto } from './dto/snooze-notification.dto';
import { UsersService } from '../user/users.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...STAFF_OPERATION_ROLES)
  @ApiOperation({ summary: 'Create a notification for a user (staff)' })
  @ApiBody({ type: CreateNotificationDto })
  create(@Body() dto: CreateNotificationDto) {
    return this.notifications.adminCreate(dto);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Unread/total counts, breakdown by type and priority',
  })
  summary(@CurrentUser() user: User) {
    return this.notifications.summary(user.id);
  }

  @Get('summary/me')
  @ApiOperation({
    summary: 'Unread/total counts for the currently logged-in user',
  })
  summaryForCurrentUser(@CurrentUser() user: User) {
    return this.notifications.summary(user.id);
  }

  @Get('digest')
  @ApiOperation({
    summary:
      'Email-style digest: subject, plain-text body, and unread notification rows (for digests / previews)',
  })
  digest(@CurrentUser() user: User) {
    return this.notifications.digest(user.id);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for current user' })
  getPreferences(@CurrentUser() user: User) {
    return this.usersService.getNotificationPreferences(user.id);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  @ApiBody({ type: NotificationPreferencesDto })
  patchPreferences(
    @CurrentUser() user: User,
    @Body() dto: NotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(user.id, {
      ...dto,
    });
  }

  @Sse('stream')
  @ApiOperation({
    summary: 'Server-Sent Events stream for real-time notifications',
  })
  @ApiProduces('text/event-stream')
  stream(@CurrentUser() user: User): Observable<MessageEvent> {
    return this.notifications.subscribeStream(user.id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: User) {
    return this.notifications.markAllRead(user.id);
  }

  @Post('read-batch')
  @ApiOperation({ summary: 'Mark specific notifications as read' })
  @ApiBody({ type: MarkReadBatchDto })
  markReadBatch(
    @CurrentUser() user: User,
    @Body() dto: MarkReadBatchDto,
  ) {
    return this.notifications.markReadBatch(user.id, dto.ids);
  }

  @Get()
  @ApiOperation({
    summary:
      'List notifications (filters: unreadOnly, type, priority, includeArchived, limit, offset)',
  })
  list(
    @CurrentUser() user: User,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('includeSnoozed') includeSnoozed?: string,
  ) {
    const pr =
      priority === 'low' || priority === 'normal' || priority === 'high'
        ? priority
        : undefined;
    return this.notifications.listForUser(user.id, {
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
      type,
      priority: pr,
      limit: limit !== undefined ? Number(limit) : undefined,
      offset: offset !== undefined ? Number(offset) : undefined,
      includeArchived: includeArchived === 'true' || includeArchived === '1',
      includeSnoozed: includeSnoozed === 'true' || includeSnoozed === '1',
    });
  }

  @Get('me')
  @ApiOperation({
    summary:
      'List notifications for the currently logged-in user (same filters as GET /notifications)',
  })
  listForCurrentUser(
    @CurrentUser() user: User,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('type') type?: string,
    @Query('priority') priority?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('includeSnoozed') includeSnoozed?: string,
  ) {
    const pr =
      priority === 'low' || priority === 'normal' || priority === 'high'
        ? priority
        : undefined;
    return this.notifications.listForUser(user.id, {
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
      type,
      priority: pr,
      limit: limit !== undefined ? Number(limit) : undefined,
      offset: offset !== undefined ? Number(offset) : undefined,
      includeArchived: includeArchived === 'true' || includeArchived === '1',
      includeSnoozed: includeSnoozed === 'true' || includeSnoozed === '1',
    });
  }

  @Delete('read')
  @ApiOperation({ summary: 'Permanently delete all read notifications' })
  purgeRead(@CurrentUser() user: User) {
    return this.notifications.purgeRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  markRead(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a notification (hidden from default list)' })
  archive(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notifications.archiveOne(user.id, id);
  }

  @Patch(':id/snooze')
  @ApiOperation({
    summary: 'Snooze — hide notification until a time (minutes or ISO date)',
  })
  @ApiBody({ type: SnoozeNotificationDto })
  snooze(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SnoozeNotificationDto,
  ) {
    return this.notifications.snooze(
      user.id,
      id,
      dto.snoozedUntil,
      dto.snoozeMinutes,
    );
  }

  @Patch(':id/unsnooze')
  @ApiOperation({ summary: 'Clear snooze so the notification shows again' })
  unsnooze(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notifications.clearSnooze(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one notification' })
  remove(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notifications.deleteOne(user.id, id);
  }
}
