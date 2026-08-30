/* eslint-disable @typescript-eslint/unbound-method */
import 'reflect-metadata';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { DashboardController } from '../dashboard.controller';
import { DashboardPeriod } from '../dashboard.constants';
import { DashboardService } from '../dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: { getOverview: jest.Mock; getTrends: jest.Mock };

  const admin: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    organizationId: 'org-a',
  };

  beforeEach(() => {
    service = {
      getOverview: jest.fn().mockResolvedValue({ summary: { total: 0 } }),
      getTrends: jest.fn().mockResolvedValue({ period: '30d', series: [] }),
    };
    controller = new DashboardController(
      service as unknown as DashboardService,
    );
  });

  it('aplica JwtAuthGuard y RolesGuard con ADMIN + TECHNICIAN a nivel de controller', () => {
    expect(Reflect.getMetadata(ROLES_KEY, DashboardController)).toEqual([
      UserRole.ADMIN,
      UserRole.TECHNICIAN,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, DashboardController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });

  it.each([UserRole.ADMIN, UserRole.TECHNICIAN])(
    'RolesGuard permite %s',
    (role) => {
      const guard = new RolesGuard(new Reflector());

      expect(guard.canActivate(createContext({ ...admin, role }))).toBe(true);
    },
  );

  it('RolesGuard rechaza USER', () => {
    const guard = new RolesGuard(new Reflector());

    expect(() =>
      guard.canActivate(createContext({ ...admin, role: UserRole.USER })),
    ).toThrow(ForbiddenException);
  });

  it('JwtAuthGuard responde 401 cuando no existe usuario autenticado', () => {
    const guard = new JwtAuthGuard();

    expect(() => guard.handleRequest<RequestUser>(null, false)).toThrow(
      UnauthorizedException,
    );
  });

  it('overview delega RequestUser completo y no acepta organizationId externo', async () => {
    await expect(controller.getOverview(admin)).resolves.toEqual({
      summary: { total: 0 },
    });
    expect(service.getOverview).toHaveBeenCalledWith(admin);
    expect(controller.getOverview).toHaveLength(1);
  });

  it('trends delega organizationId desde RequestUser y period desde DTO', async () => {
    await controller.getTrends(admin, {
      period: DashboardPeriod.SEVEN_DAYS,
    });

    expect(service.getTrends).toHaveBeenCalledWith(
      admin,
      DashboardPeriod.SEVEN_DAYS,
    );
    expect(controller.getTrends).toHaveLength(2);
  });

  function createContext(user: RequestUser): ExecutionContext {
    return {
      getHandler: () => DashboardController.prototype.getOverview,
      getClass: () => DashboardController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }
});
