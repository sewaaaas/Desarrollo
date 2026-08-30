import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSettingsDto } from '../dto/update-settings.dto';

describe('UpdateSettingsDto', () => {
  it.each(['UTC', 'America/Lima', 'America/Bogota'])(
    'acepta timezone IANA válido %s',
    async (timezone) => {
      const dto = plainToInstance(UpdateSettingsDto, { timezone });

      expect(await validate(dto)).toHaveLength(0);
      expect(dto.timezone).toBe(timezone);
    },
  );

  it('aplica trim antes de validar', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {
      timezone: '  America/Lima  ',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.timezone).toBe('America/Lima');
  });

  it('permite un PATCH vacío', async () => {
    const dto = plainToInstance(UpdateSettingsDto, {});

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.timezone).toBeUndefined();
  });

  it.each(['Invalid/Zone', 'GMT+5', '', '   ', null, 123, true, {}])(
    'rechaza timezone inválido %p',
    async (timezone) => {
      const dto = plainToInstance(UpdateSettingsDto, { timezone });
      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).toContain('timezone');
    },
  );

  it.each([
    ['unknown', true],
    ['organizationId', 'org-b'],
    ['language', 'es'],
    ['dateFormat', 'DD/MM/YYYY'],
  ])(
    'rechaza propiedad desconocida %s con el pipe global',
    async (key, value) => {
      const pipe = new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: false },
      });

      await expect(
        pipe.transform(
          { timezone: 'UTC', [key]: value },
          { type: 'body', metatype: UpdateSettingsDto },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
