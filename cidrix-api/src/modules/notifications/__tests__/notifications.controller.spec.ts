/* eslint-disable @typescript-eslint/unbound-method */
import 'reflect-metadata';
import {
  BadRequestException,
  ExecutionContext,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: {
    list: jest.Mock;
    getUnreadCount: jest.Mock;
    markRead: jest.Mock;
    markAllRead: jest.Mock;
  };

  const user: RequestUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: UserRole.USER,
    organizationId: 'org-a',
  };

  beforeEach(() => {
    service = {
      list: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      getUnreadCount: jest.fn().mockResolvedValue({ count: 0 }),
      markRead: jest.fn().mockResolvedValue({ id: 'notification-1' }),
      markAllRead: jest.fn().mockResolvedValue({ updatedCount: 0 }),
    };
    controller = new NotificationsController(
      service as unknown as NotificationsService,
    );
  });

  it('aplica JWT, RolesGuard y los tres roles a la bandeja personal', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, NotificationsController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, NotificationsController)).toEqual([
      UserRole.ADMIN,
      UserRole.TECHNICIAN,
      UserRole.USER,
    ]);
  });

  it.each([UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER])(
    'RolesGuard permite %s',
    (role) => {
      const guard = new RolesGuard(new Reflector());
      expect(guard.canActivate(createContext({ ...user, role }))).toBe(true);
    },
  );

  it('JwtAuthGuard responde 401 sin autenticación', () => {
    expect(() => new JwtAuthGuard().handleRequest(null, false)).toThrow(
      UnauthorizedException,
    );
  });

  it('delega los cuatro endpoints usando únicamente CurrentUser', async () => {
    const filters = { page: 2, limit: 10, isRead: false };
    const id = '1e2dfd44-877a-40db-934d-bc505b773b0c';

    await controller.list(user, filters);
    await controller.getUnreadCount(user);
    await controller.markRead(user, id);
    await controller.markAllRead(user);

    expect(service.list).toHaveBeenCalledWith(user, filters);
    expect(service.getUnreadCount).toHaveBeenCalledWith(user);
    expect(service.markRead).toHaveBeenCalledWith(user, id);
    expect(service.markAllRead).toHaveBeenCalledWith(user);
    expect(controller.list).toHaveLength(2);
    expect(controller.getUnreadCount).toHaveLength(1);
    expect(controller.markRead).toHaveLength(2);
    expect(controller.markAllRead).toHaveLength(1);
  });

  it('ParseUUIDPipe rechaza ids inválidos con 400', async () => {
    await expect(
      new ParseUUIDPipe({ version: '4' }).transform('no-es-uuid', {
        type: 'param',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  function createContext(currentUser: RequestUser): ExecutionContext {
    return {
      getHandler: () => NotificationsController.prototype.list,
      getClass: () => NotificationsController,
      switchToHttp: () => ({ getRequest: () => ({ user: currentUser }) }),
    } as unknown as ExecutionContext;
  }
});
