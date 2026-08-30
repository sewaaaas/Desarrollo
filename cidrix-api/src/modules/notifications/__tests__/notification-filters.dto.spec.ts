import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NotificationFiltersDto } from '../dto/notification-filters.dto';

describe('NotificationFiltersDto', () => {
  it('usa page=1 y limit=20 por defecto', async () => {
    const dto = plainToInstance(NotificationFiltersDto, {});

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, limit: 20 });
  });

  it.each([
    [
      { page: '1', limit: '1' },
      { page: 1, limit: 1 },
    ],
    [
      { page: '2', limit: '100' },
      { page: 2, limit: 100 },
    ],
  ])('transforma y acepta límites válidos %#', async (input, expected) => {
    const dto = plainToInstance(NotificationFiltersDto, input);

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject(expected);
  });

  it.each([
    { page: '0' },
    { page: '1.5' },
    { limit: '0' },
    { limit: '101' },
    { limit: 'abc' },
  ])('rechaza paginación inválida %#', async (input) => {
    expect(
      await validate(plainToInstance(NotificationFiltersDto, input)),
    ).not.toHaveLength(0);
  });

  it.each([
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
  ])('transforma isRead=%p estrictamente a %p', async (value, expected) => {
    const dto = plainToInstance(NotificationFiltersDto, { isRead: value });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.isRead).toBe(expected);
  });

  it.each(['yes', '1', 'TRUE', '', 1, 0])(
    'rechaza el booleano arbitrario %p',
    async (isRead) => {
      const errors = await validate(
        plainToInstance(NotificationFiltersDto, { isRead }),
      );

      expect(errors.map((error) => error.property)).toContain('isRead');
    },
  );

  it('rechaza propiedades desconocidas con el pipe global', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    });

    await expect(
      pipe.transform(
        { page: '1', userId: 'otro-usuario' },
        { type: 'query', metatype: NotificationFiltersDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
