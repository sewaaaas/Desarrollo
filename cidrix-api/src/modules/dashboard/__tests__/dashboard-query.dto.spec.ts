import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DashboardPeriod } from '../dashboard.constants';
import { DashboardQueryDto } from '../dto/dashboard-query.dto';

describe('DashboardQueryDto', () => {
  it('usa 30d por defecto cuando period no se envía', async () => {
    const dto = plainToInstance(DashboardQueryDto, {});

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.period).toBe(DashboardPeriod.THIRTY_DAYS);
  });

  it.each([
    DashboardPeriod.SEVEN_DAYS,
    DashboardPeriod.THIRTY_DAYS,
    DashboardPeriod.NINETY_DAYS,
  ])('acepta el período %s', async (period) => {
    const dto = plainToInstance(DashboardQueryDto, { period });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.period).toBe(period);
  });

  it.each(['1d', '14d', '365d', '30D', 'arbitrary'])(
    'rechaza el período inválido %s',
    async (period) => {
      const errors = await validate(
        plainToInstance(DashboardQueryDto, { period }),
      );

      expect(errors.map((error) => error.property)).toContain('period');
    },
  );

  it('rechaza campos desconocidos con la configuración del pipe global', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        { period: '30d', dateFrom: '2026-08-01' },
        { type: 'query', metatype: DashboardQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
