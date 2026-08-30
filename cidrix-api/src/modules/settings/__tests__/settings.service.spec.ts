import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@database/prisma.service';
import { SettingsService } from '../settings.service';

describe('SettingsService', () => {
  const ORG_ID = 'org-a';
  let service: SettingsService;
  let prisma: {
    organization: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      organization: {
        findFirst: jest.fn().mockResolvedValue({ settings: {} }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new SettingsService(prisma as unknown as PrismaService);
  });

  describe('GET', () => {
    it('devuelve timezone válido canonicalizado y oculta legacy', async () => {
      prisma.organization.findFirst.mockResolvedValue({
        settings: {
          timezone: 'America/Bogota',
          language: 'es',
          dateFormat: 'DD/MM/YYYY',
          futureKey: { enabled: true },
        },
      });

      await expect(service.getSettings(ORG_ID)).resolves.toEqual({
        timezone: 'America/Bogota',
      });
      expect(prisma.organization.findFirst).toHaveBeenCalledWith({
        where: { id: ORG_ID, isActive: true },
        select: { settings: true },
      });
      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      { settings: {}, caseName: 'objeto vacío' },
      { settings: { language: 'es' }, caseName: 'timezone ausente' },
      {
        settings: { timezone: 'Invalid/Zone' },
        caseName: 'timezone inválido',
      },
      { settings: { timezone: 123 }, caseName: 'timezone no string' },
      { settings: null, caseName: 'JSON null' },
      { settings: [], caseName: 'array' },
      { settings: 'legacy', caseName: 'string scalar' },
      { settings: 123, caseName: 'number scalar' },
      { settings: true, caseName: 'boolean scalar' },
    ])('aplica UTC para $caseName', async ({ settings }) => {
      prisma.organization.findFirst.mockResolvedValue({ settings });

      await expect(service.getSettings(ORG_ID)).resolves.toEqual({
        timezone: 'UTC',
      });
      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });

    it.each(['inexistente', 'inactiva'])(
      'retorna 404 uniforme para organización %s',
      async () => {
        prisma.organization.findFirst.mockResolvedValue(null);

        await expect(service.getSettings(ORG_ID)).rejects.toBeInstanceOf(
          NotFoundException,
        );
        expect(prisma.organization.updateMany).not.toHaveBeenCalled();
      },
    );
  });

  describe('PATCH', () => {
    it('actualiza timezone, preserva todas las keys legacy y retorna allowlist', async () => {
      prisma.organization.findFirst.mockResolvedValue({
        settings: {
          timezone: 'America/Bogota',
          language: 'es',
          dateFormat: 'DD/MM/YYYY',
          futureKey: { enabled: true },
        },
      });

      const result = await service.updateSettings(ORG_ID, {
        timezone: 'America/Lima',
      });

      expect(result).toEqual({ timezone: 'America/Lima' });
      expect(result).not.toHaveProperty('language');
      expect(result).not.toHaveProperty('dateFormat');
      expect(prisma.organization.updateMany).toHaveBeenCalledWith({
        where: { id: ORG_ID, isActive: true },
        data: {
          settings: {
            timezone: 'America/Lima',
            language: 'es',
            dateFormat: 'DD/MM/YYYY',
            futureKey: { enabled: true },
          },
        },
      });
    });

    it.each([
      ['America/Lima', 'America/Lima'],
      ['america/lima', 'America/Lima'],
    ])(
      'no escribe si persisted=%s coincide canónicamente con request=%s',
      async (persisted, requested) => {
        prisma.organization.findFirst.mockResolvedValue({
          settings: { timezone: persisted, language: 'es' },
        });

        await expect(
          service.updateSettings(ORG_ID, { timezone: requested }),
        ).resolves.toEqual({ timezone: 'America/Lima' });
        expect(prisma.organization.updateMany).not.toHaveBeenCalled();
      },
    );

    it('escribe UTC si timezone persistido está ausente aunque el fallback sea UTC', async () => {
      prisma.organization.findFirst.mockResolvedValue({
        settings: { language: 'es' },
      });

      await expect(
        service.updateSettings(ORG_ID, { timezone: 'UTC' }),
      ).resolves.toEqual({ timezone: 'UTC' });
      expect(prisma.organization.updateMany).toHaveBeenCalledWith({
        where: { id: ORG_ID, isActive: true },
        data: { settings: { language: 'es', timezone: 'UTC' } },
      });
    });

    it('sanea timezone legacy inválido mediante PATCH UTC y preserva legacy', async () => {
      prisma.organization.findFirst.mockResolvedValue({
        settings: {
          timezone: 'Invalid/Zone',
          language: 'es',
          dateFormat: 'DD/MM/YYYY',
        },
      });

      await expect(
        service.updateSettings(ORG_ID, { timezone: 'UTC' }),
      ).resolves.toEqual({ timezone: 'UTC' });
      expect(prisma.organization.updateMany).toHaveBeenCalledWith({
        where: { id: ORG_ID, isActive: true },
        data: {
          settings: {
            timezone: 'UTC',
            language: 'es',
            dateFormat: 'DD/MM/YYYY',
          },
        },
      });
    });

    it('PATCH vacío devuelve settings efectivos y no escribe', async () => {
      prisma.organization.findFirst.mockResolvedValue({
        settings: { timezone: 'Invalid/Zone', language: 'es' },
      });

      await expect(service.updateSettings(ORG_ID, {})).resolves.toEqual({
        timezone: 'UTC',
      });
      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      { settings: null, caseName: 'JSON null' },
      { settings: [], caseName: 'array' },
      { settings: 'legacy', caseName: 'string' },
      { settings: 123, caseName: 'number' },
      { settings: true, caseName: 'boolean' },
    ])(
      'rechaza root inconsistente $caseName sin sobrescribirlo',
      async ({ settings }) => {
        prisma.organization.findFirst.mockResolvedValue({ settings });

        await expect(
          service.updateSettings(ORG_ID, { timezone: 'UTC' }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.organization.updateMany).not.toHaveBeenCalled();
      },
    );

    it('rechaza defensivamente timezone inválido aunque el DTO sea omitido', async () => {
      prisma.organization.findFirst.mockResolvedValue({ settings: {} });

      await expect(
        service.updateSettings(ORG_ID, { timezone: 'Invalid/Zone' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.organization.updateMany).not.toHaveBeenCalled();
    });

    it('ignora propiedades request no soportadas aun si el service se invoca directamente', async () => {
      prisma.organization.findFirst.mockResolvedValue({
        settings: { language: 'es' },
      });
      const dto = {
        timezone: 'America/Lima',
        language: 'en',
      } as unknown as { timezone: string };

      await service.updateSettings(ORG_ID, dto);

      expect(prisma.organization.updateMany).toHaveBeenCalledWith({
        where: { id: ORG_ID, isActive: true },
        data: {
          settings: { language: 'es', timezone: 'America/Lima' },
        },
      });
    });

    it.each(['inexistente', 'inactiva'])(
      'retorna 404 uniforme para organización %s',
      async () => {
        prisma.organization.findFirst.mockResolvedValue(null);

        await expect(
          service.updateSettings(ORG_ID, { timezone: 'UTC' }),
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.organization.updateMany).not.toHaveBeenCalled();
      },
    );

    it('falla cerrado si la organización se desactiva entre lectura y escritura', async () => {
      prisma.organization.findFirst.mockResolvedValue({ settings: {} });
      prisma.organization.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateSettings(ORG_ID, { timezone: 'America/Lima' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.organization.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ORG_ID, isActive: true },
        }),
      );
    });
  });
});
