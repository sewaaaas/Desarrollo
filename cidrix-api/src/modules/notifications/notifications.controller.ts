import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { NotificationFiltersDto } from './dto/notification-filters.dto';
import {
  NotificationResponseDto,
  PaginatedNotificationsDto,
  ReadAllResponseDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() currentUser: RequestUser,
    @Query() filters: NotificationFiltersDto,
  ): Promise<PaginatedNotificationsDto> {
    return this.notificationsService.list(currentUser, filters);
  }

  @Get('unread-count')
  getUnreadCount(
    @CurrentUser() currentUser: RequestUser,
  ): Promise<UnreadCountResponseDto> {
    return this.notificationsService.getUnreadCount(currentUser);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() currentUser: RequestUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<NotificationResponseDto> {
    return this.notificationsService.markRead(currentUser, id);
  }

  @Patch('read-all')
  markAllRead(
    @CurrentUser() currentUser: RequestUser,
  ): Promise<ReadAllResponseDto> {
    return this.notificationsService.markAllRead(currentUser);
  }
}
