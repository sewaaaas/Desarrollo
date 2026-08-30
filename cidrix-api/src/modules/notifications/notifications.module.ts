import { Module } from '@nestjs/common';
import { NotificationEventsListener } from './listeners/notification-events.listener';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationEventsListener,
  ],
})
export class NotificationsModule {}
