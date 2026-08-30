import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { EVENT_LISTENER_METADATA } from '@nestjs/event-emitter/dist/constants';
import {
  CommentAddedEvent,
  EVENTS,
  TicketAssignedEvent,
  TicketCreatedEvent,
  TicketStatusChangedEvent,
} from '@integrations/events/event-types';
import { NotificationEventsListener } from '../listeners/notification-events.listener';
import { NotificationsService } from '../notifications.service';

describe('NotificationEventsListener', () => {
  let listener: NotificationEventsListener;
  let service: {
    handleTicketCreated: jest.Mock;
    handleTicketAssigned: jest.Mock;
    handleTicketStatusChanged: jest.Mock;
    handleCommentAdded: jest.Mock;
  };

  const base = {
    organizationId: 'org-a',
    ticketId: 'ticket-1',
    occurredAt: new Date('2026-08-30T10:00:00.000Z'),
  };

  beforeEach(() => {
    service = {
      handleTicketCreated: jest.fn().mockResolvedValue(undefined),
      handleTicketAssigned: jest.fn().mockResolvedValue(undefined),
      handleTicketStatusChanged: jest.fn().mockResolvedValue(undefined),
      handleCommentAdded: jest.fn().mockResolvedValue(undefined),
    };
    listener = new NotificationEventsListener(
      service as unknown as NotificationsService,
    );
  });

  it('registra exactamente los cuatro eventos aprobados con suppressErrors', () => {
    const methods = [
      'onTicketCreated',
      'onTicketAssigned',
      'onTicketStatusChanged',
      'onCommentAdded',
    ] as const;
    const metadata = methods.flatMap(
      (method) =>
        Reflect.getMetadata(
          EVENT_LISTENER_METADATA,
          NotificationEventsListener.prototype[method],
        ) as Array<{ event: string; options: { suppressErrors: boolean } }>,
    );

    expect(metadata).toEqual([
      { event: EVENTS.TICKET_CREATED, options: { suppressErrors: true } },
      { event: EVENTS.TICKET_ASSIGNED, options: { suppressErrors: true } },
      {
        event: EVENTS.TICKET_STATUS_CHANGED,
        options: { suppressErrors: true },
      },
      { event: EVENTS.COMMENT_ADDED, options: { suppressErrors: true } },
    ]);
    expect(metadata.map(({ event }) => event)).not.toContain(
      EVENTS.TICKET_FIRST_RESPONSE,
    );
    expect(metadata.map(({ event }) => event)).not.toContain(
      EVENTS.TICKET_CLOSED,
    );
  });

  it('delega los payloads al service', async () => {
    const created = {
      ...base,
      ticketNumber: 'TKT-0001',
      priority: 'MEDIUM',
      categoryId: null,
      createdBy: 'user-1',
      assignedTo: 'tech-1',
      slaPolicyId: null,
    } satisfies TicketCreatedEvent;
    const assigned = {
      ...base,
      assignedTo: 'tech-2',
      assignedBy: 'admin-1',
      previousAssignee: 'tech-1',
    } satisfies TicketAssignedEvent;
    const status = {
      ...base,
      from: 'PENDING',
      to: 'IN_PROGRESS',
      changedBy: 'tech-1',
    } satisfies TicketStatusChangedEvent;
    const comment = {
      ...base,
      commentId: 'comment-1',
      authorId: 'user-1',
      isInternal: false,
    } satisfies CommentAddedEvent;

    await listener.onTicketCreated(created);
    await listener.onTicketAssigned(assigned);
    await listener.onTicketStatusChanged(status);
    await listener.onCommentAdded(comment);

    expect(service.handleTicketCreated).toHaveBeenCalledWith(created);
    expect(service.handleTicketAssigned).toHaveBeenCalledWith(assigned);
    expect(service.handleTicketStatusChanged).toHaveBeenCalledWith(status);
    expect(service.handleCommentAdded).toHaveBeenCalledWith(comment);
  });

  it('registra el contexto seguro y no propaga fallos del service', async () => {
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    service.handleCommentAdded.mockRejectedValue(new Error('database down'));
    const event: CommentAddedEvent = {
      ...base,
      commentId: 'comment-1',
      authorId: 'user-1',
      isInternal: false,
    };

    await expect(listener.onCommentAdded(event)).resolves.toBeUndefined();
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining(
        'event=comment.added organizationId=org-a ticketId=ticket-1',
      ),
      expect.stringContaining('database down'),
    );
    logger.mockRestore();
  });
});
