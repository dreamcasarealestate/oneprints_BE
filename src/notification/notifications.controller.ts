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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../user/user.entity';
import { UserKind } from '../user/user-kind.enum';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserKind.ADMIN,
    UserKind.SUPER_ADMIN,
    UserKind.OPS_HEAD,
    UserKind.BRANCH_MANAGER,
    UserKind.STAFF,
  )
  @ApiOperation({ summary: 'Create a notification for a user' })
  @ApiBody({ type: CreateNotificationDto })
  create(@Body() dto: CreateNotificationDto) {
    return this.notifications.create(
      dto.userId,
      dto.type,
      dto.title,
      dto.message,
      dto.metadata,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  list(@CurrentUser() user: User) {
    return this.notifications.listForUser(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.notifications.markRead(user.id, id);
  }
}
