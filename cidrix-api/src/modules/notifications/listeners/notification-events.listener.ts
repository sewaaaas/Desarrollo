import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CommentAddedEvent,
  EVENTS,
  TicketAssignedEvent,
  TicketCreatedEvent,
  TicketStatusChangedEvent,
} from '@integrations/events/event-types';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class NotificationEventsListener {
  private readonly logger = new Logger(NotificationEventsListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(EVENTS.TICKET_CREATED, { suppressErrors: true })
  onTicketCreated(event: TicketCreatedEvent): Promise<void> {
    return this.runSafely(EVENTS.TICKET_CREATED, event, () =>
      this.notificationsService.handleTicketCreated(event),
    );
  }

  @OnEvent(EVENTS.TICKET_ASSIGNED, { suppressErrors: true })
  onTicketAssigned(event: TicketAssignedEvent): Promise<void> {
    return this.runSafely(EVENTS.TICKET_ASSIGNED, event, () =>
      this.notificationsService.handleTicketAssigned(event),
    );
  }

  @OnEvent(EVENTS.TICKET_STATUS_CHANGED, { suppressErrors: true })
  onTicketStatusChanged(event: TicketStatusChangedEvent): Promise<void> {
    return this.runSafely(EVENTS.TICKET_STATUS_CHANGED, event, () =>
      this.notificationsService.handleTicketStatusChanged(event),
    );
  }

  @OnEvent(EVENTS.COMMENT_ADDED, { suppressErrors: true })
  onCommentAdded(event: CommentAddedEvent): Promise<void> {
    return this.runSafely(EVENTS.COMMENT_ADDED, event, () =>
      this.notificationsService.handleCommentAdded(event),
    );
  }

  private async runSafely(
    eventName: string,
    event: { organizationId: string; ticketId: string },
    handler: () => Promise<void>,
  ): Promise<void> {
    try {
      await handler();
    } catch (error: unknown) {
      const technicalError =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
      this.logger.error(
        `Notification listener failed: event=${eventName} organizationId=${event.organizationId} ticketId=${event.ticketId}`,
        technicalError,
      );
    }
  }
}
