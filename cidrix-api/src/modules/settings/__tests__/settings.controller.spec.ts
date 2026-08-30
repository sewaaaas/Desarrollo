/* eslint-disable @typescript-eslint/unbound-method */
import 'reflect-metadata';
import {
  ExecutionContext,
  ForbiddenException,
  RequestMethod,
  UnauthorizedException,
} from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '@common/decorators/roles.decorator';
import { RolesGuard } from '@common/guards/roles.guard';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import { SettingsController } from '../settings.controller';
import { SettingsService } from '../settings.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: { getSettings: jest.Mock; updateSettings: jest.Mock };

  const admin: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    organizationId: 'org-a',
  };

  beforeEach(() => {
    service = {
      getSettings: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
      updateSettings: jest.fn().mockResolvedValue({ timezone: 'America/Lima' }),
    };
    controller = new SettingsController(service as unknown as SettingsService);
  });

  it('registra exactamente /settings con GET y PATCH', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SettingsController)).toBe(
      'settings',
    );
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        SettingsController.prototype.getSettings,
      ),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata(
        METHOD_METADATA,
        SettingsController.prototype.updateSettings,
      ),
    ).toBe(RequestMethod.PATCH);
  });

  it('aplica JwtAuthGuard y RolesGuard a nivel controller', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SettingsController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });

  it('GET declara ADMIN, TECHNICIAN y USER', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, SettingsController.prototype.getSettings),
    ).toEqual([UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER]);
  });

  it('PATCH declara solo ADMIN', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        SettingsController.prototype.updateSettings,
      ),
    ).toEqual([UserRole.ADMIN]);
  });

  it.each([UserRole.ADMIN, UserRole.TECHNICIAN, UserRole.USER])(
    'RolesGuard permite GET a %s',
    (role) => {
      const guard = new RolesGuard(new Reflector());
      expect(
        guard.canActivate(
          createContext(SettingsController.prototype.getSettings, {
            ...admin,
            role,
          }),
        ),
      ).toBe(true);
    },
  );

  it('RolesGuard permite PATCH a ADMIN', () => {
    const guard = new RolesGuard(new Reflector());
    expect(
      guard.canActivate(
        createContext(SettingsController.prototype.updateSettings, admin),
      ),
    ).toBe(true);
  });

  it.each([UserRole.TECHNICIAN, UserRole.USER])(
    'RolesGuard rechaza PATCH a %s con 403',
    (role) => {
      const guard = new RolesGuard(new Reflector());
      expect(() =>
        guard.canActivate(
          createContext(SettingsController.prototype.updateSettings, {
            ...admin,
            role,
          }),
        ),
      ).toThrow(ForbiddenException);
    },
  );

  it('JwtAuthGuard responde 401 sin JWT', () => {
    expect(() => new JwtAuthGuard().handleRequest(null, false)).toThrow(
      UnauthorizedException,
    );
  });

  it('delega únicamente organizationId de CurrentUser y DTO cerrado', async () => {
    const dto = { timezone: 'America/Lima' };

    await expect(controller.getSettings(admin)).resolves.toEqual({
      timezone: 'UTC',
    });
    await expect(controller.updateSettings(admin, dto)).resolves.toEqual({
      timezone: 'America/Lima',
    });
    expect(service.getSettings).toHaveBeenCalledWith('org-a');
    expect(service.updateSettings).toHaveBeenCalledWith('org-a', dto);
    expect(controller.getSettings).toHaveLength(1);
    expect(controller.updateSettings).toHaveLength(2);
  });

  function createContext(
    handler:
      SettingsController['getSettings'] | SettingsController['updateSettings'],
    user: RequestUser,
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => SettingsController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }
});
