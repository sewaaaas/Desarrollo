import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SortOrder } from '../dto/ticket-filters.dto';
import { TicketTimelineFiltersDto } from '../dto/ticket-timeline-filters.dto';

describe('TicketTimelineFiltersDto', () => {
  it('usa page=1, limit=20 y order=asc por defecto', async () => {
    const dto = plainToInstance(TicketTimelineFiltersDto, {});

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toEqual(
      expect.objectContaining({ page: 1, limit: 20, order: SortOrder.ASC }),
    );
  });

  it('transforma page y limit desde query string', async () => {
    const dto = plainToInstance(TicketTimelineFiltersDto, {
      page: '2',
      limit: '50',
      order: SortOrder.DESC,
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    expect(dto.order).toBe(SortOrder.DESC);
  });

  it('rechaza page menor a 1, limit mayor a 100 y order inválido', async () => {
    const dto = plainToInstance(TicketTimelineFiltersDto, {
      page: '0',
      limit: '101',
      order: 'sideways',
    });
    const errors = await validate(dto);

    expect(errors.map((error) => error.property).sort()).toEqual([
      'limit',
      'order',
      'page',
    ]);
  });
});
