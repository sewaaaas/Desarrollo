/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import 'reflect-metadata';
import {
  TicketPriority,
  TicketStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import {
  ACTIVE_WORKLOAD_STATUSES,
  DashboardPeriod,
} from '../dashboard.constants';
import { DashboardRepository } from '../dashboard.repository';
import { DashboardService } from '../dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let repository: {
    getStatusGroups: jest.Mock;
    getPriorityGroups: jest.Mock;
    getCategoryGroups: jest.Mock;
    getWorkloadGroups: jest.Mock;
    getResolutionAverages: jest.Mock;
    findCategories: jest.Mock;
    findAssignees: jest.Mock;
    getTrendRows: jest.Mock;
  };

  const currentUser: RequestUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    organizationId: 'org-a',
  };

  beforeEach(() => {
    repository = {
      getStatusGroups: jest.fn().mockResolvedValue([]),
      getPriorityGroups: jest.fn().mockResolvedValue([]),
      getCategoryGroups: jest.fn().mockResolvedValue([]),
      getWorkloadGroups: jest.fn().mockResolvedValue([]),
      getResolutionAverages: jest.fn().mockResolvedValue({
        resolutionSampleCount: 0,
        averageResolutionSeconds: null,
        closureSampleCount: 0,
        averageClosureSeconds: null,
      }),
      findCategories: jest.fn().mockResolvedValue([]),
      findAssignees: jest.fn().mockResolvedValue([]),
      getTrendRows: jest.fn().mockResolvedValue([]),
    };
    service = new DashboardService(
      repository as unknown as DashboardRepository,
    );
  });

  it('organización vacía retorna contrato completo con ceros y null', async () => {
    await expect(service.getOverview(currentUser)).resolves.toEqual({
      summary: {
        total: 0,
        byStatus: {
          OPEN: 0,
          IN_PROGRESS: 0,
          PENDING: 0,
          RESOLVED: 0,
          CLOSED: 0,
          CANCELLED: 0,
        },
      },
      byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      byCategory: [],
      assigneeWorkload: {
        activeStatuses: ['OPEN', 'IN_PROGRESS', 'PENDING'],
        unassignedTickets: 0,
        assignees: [],
      },
      resolutionTime: {
        resolutionSampleCount: 0,
        averageResolutionSeconds: null,
        closureSampleCount: 0,
        averageClosureSeconds: null,
      },
    });
    expect(repository.getStatusGroups).toHaveBeenCalledWith('org-a');
    expect(repository.findCategories).toHaveBeenCalledWith('org-a', []);
    expect(repository.findAssignees).toHaveBeenCalledWith('org-a', []);
  });

  it('completa status/prioridades ausentes y total es la suma de byStatus', async () => {
    repository.getStatusGroups.mockResolvedValue([
      { status: TicketStatus.OPEN, _count: { _all: 3 } },
      { status: TicketStatus.RESOLVED, _count: { _all: 2 } },
      { status: TicketStatus.CLOSED, _count: { _all: 4 } },
    ]);
    repository.getPriorityGroups.mockResolvedValue([
      { priority: TicketPriority.HIGH, _count: { _all: 5 } },
    ]);

    const result = await service.getOverview(currentUser);

    expect(result.summary.total).toBe(9);
    expect(result.summary.byStatus).toEqual({
      OPEN: 3,
      IN_PROGRESS: 0,
      PENDING: 0,
      RESOLVED: 2,
      CLOSED: 4,
      CANCELLED: 0,
    });
    expect(result.byPriority).toEqual({
      LOW: 0,
      MEDIUM: 0,
      HIGH: 5,
      CRITICAL: 0,
    });
  });

  it('mapea Sin categoría, activa, inactiva y soft-deleted con orden determinista', async () => {
    repository.getCategoryGroups.mockResolvedValue([
      { categoryId: 'category-z', _count: { _all: 2 } },
      { categoryId: null, _count: { _all: 1 } },
      { categoryId: 'category-b', _count: { _all: 4 } },
      { categoryId: 'category-a', _count: { _all: 4 } },
      { categoryId: 'foreign-unresolved', _count: { _all: 99 } },
    ]);
    repository.findCategories.mockResolvedValue([
      {
        id: 'category-z',
        name: 'Zeta',
        isActive: true,
        deletedAt: null,
      },
      {
        id: 'category-b',
        name: 'Beta',
        isActive: false,
        deletedAt: null,
      },
      {
        id: 'category-a',
        name: 'Alfa',
        isActive: false,
        deletedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'not-requested-other-tenant',
        name: 'Foreign',
        isActive: true,
        deletedAt: null,
      },
    ]);

    const result = await service.getOverview(currentUser);

    expect(result.byCategory).toEqual([
      {
        categoryId: 'category-a',
        categoryName: 'Alfa',
        isActive: false,
        isDeleted: true,
        count: 4,
      },
      {
        categoryId: 'category-b',
        categoryName: 'Beta',
        isActive: false,
        isDeleted: false,
        count: 4,
      },
      {
        categoryId: 'category-z',
        categoryName: 'Zeta',
        isActive: true,
        isDeleted: false,
        count: 2,
      },
      {
        categoryId: null,
        categoryName: 'Sin categoría',
        isActive: false,
        isDeleted: false,
        count: 1,
      },
    ]);
    expect(result.byCategory).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoryName: 'Foreign' }),
      ]),
    );
  });

  it('incluye TECHNICIAN, ADMIN, inactivo y eliminado sin datos sensibles', async () => {
    repository.getWorkloadGroups.mockResolvedValue([
      {
        assignedToId: 'tech-1',
        status: TicketStatus.OPEN,
        _count: { _all: 2 },
      },
      {
        assignedToId: 'tech-1',
        status: TicketStatus.PENDING,
        _count: { _all: 1 },
      },
      {
        assignedToId: 'admin-1',
        status: TicketStatus.IN_PROGRESS,
        _count: { _all: 3 },
      },
      {
        assignedToId: 'inactive-1',
        status: TicketStatus.OPEN,
        _count: { _all: 1 },
      },
      {
        assignedToId: 'deleted-1',
        status: TicketStatus.PENDING,
        _count: { _all: 2 },
      },
      { assignedToId: null, status: TicketStatus.OPEN, _count: { _all: 7 } },
    ]);
    repository.findAssignees.mockResolvedValue([
      {
        id: 'tech-1',
        fullName: 'Beta',
        role: UserRole.TECHNICIAN,
        status: UserStatus.ACTIVE,
      },
      {
        id: 'admin-1',
        fullName: 'Alfa',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
      {
        id: 'inactive-1',
        fullName: 'Delta',
        role: UserRole.TECHNICIAN,
        status: UserStatus.INACTIVE,
      },
      {
        id: 'deleted-1',
        fullName: 'Gamma',
        role: UserRole.TECHNICIAN,
        status: UserStatus.DELETED,
      },
      {
        id: 'other-tenant',
        fullName: 'Foreign',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      },
    ]);

    const result = await service.getOverview(currentUser);

    expect(result.assigneeWorkload.unassignedTickets).toBe(7);
    expect(
      result.assigneeWorkload.assignees.map((item) => item.assigneeId),
    ).toEqual(['admin-1', 'tech-1', 'deleted-1', 'inactive-1']);
    expect(result.assigneeWorkload.assignees[0]).toEqual({
      assigneeId: 'admin-1',
      assigneeName: 'Alfa',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      activeTickets: 3,
      byStatus: { OPEN: 0, IN_PROGRESS: 3, PENDING: 0 },
    });
    expect(JSON.stringify(result.assigneeWorkload)).not.toContain('email');
    expect(JSON.stringify(result.assigneeWorkload)).not.toContain(
      'organizationId',
    );
  });

  it('descarta RESOLVED, CLOSED y CANCELLED de workload aun si repository los devuelve', async () => {
    repository.getWorkloadGroups.mockResolvedValue([
      {
        assignedToId: 'tech-1',
        status: TicketStatus.OPEN,
        _count: { _all: 1 },
      },
      {
        assignedToId: 'tech-1',
        status: TicketStatus.RESOLVED,
        _count: { _all: 20 },
      },
      { assignedToId: null, status: TicketStatus.CLOSED, _count: { _all: 30 } },
      {
        assignedToId: null,
        status: TicketStatus.CANCELLED,
        _count: { _all: 40 },
      },
    ]);
    repository.findAssignees.mockResolvedValue([
      {
        id: 'tech-1',
        fullName: 'Tech',
        role: UserRole.TECHNICIAN,
        status: UserStatus.ACTIVE,
      },
    ]);

    const result = await service.getOverview(currentUser);

    expect(result.assigneeWorkload.activeStatuses).toEqual([
      TicketStatus.OPEN,
      TicketStatus.IN_PROGRESS,
      TicketStatus.PENDING,
    ]);
    expect(result.assigneeWorkload.unassignedTickets).toBe(0);
    expect(result.assigneeWorkload.assignees[0].activeTickets).toBe(1);
    expect(result.assigneeWorkload.assignees[0].byStatus).toEqual({
      OPEN: 1,
      IN_PROGRESS: 0,
      PENDING: 0,
    });
    expect(ACTIVE_WORKLOAD_STATUSES).not.toContain(TicketStatus.RESOLVED);
  });

  it('normaliza promedios, conserva sample counts y nunca retorna NaN/Infinity', async () => {
    repository.getResolutionAverages.mockResolvedValue({
      resolutionSampleCount: 4,
      averageResolutionSeconds: 100.6,
      closureSampleCount: 2,
      averageClosureSeconds: Number.POSITIVE_INFINITY,
    });

    const result = await service.getOverview(currentUser);

    expect(result.resolutionTime).toEqual({
      resolutionSampleCount: 4,
      averageResolutionSeconds: 101,
      closureSampleCount: 2,
      averageClosureSeconds: null,
    });
  });

  it('calcula períodos UTC semiabiertos de 7d, 30d y 90d', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T23:59:59.999Z'));

    for (const [period, expectedStart, rows] of [
      [DashboardPeriod.SEVEN_DAYS, '2026-08-09T00:00:00.000Z', 7],
      [DashboardPeriod.THIRTY_DAYS, '2026-07-17T00:00:00.000Z', 30],
      [DashboardPeriod.NINETY_DAYS, '2026-05-18T00:00:00.000Z', 90],
    ] as const) {
      repository.getTrendRows.mockResolvedValue(
        Array.from({ length: rows }, (_, index) => ({
          date: `day-${index}`,
          created: 0,
          closed: 0,
        })),
      );

      const result = await service.getTrends(currentUser, period);
      const lastCall =
        repository.getTrendRows.mock.calls[
          repository.getTrendRows.mock.calls.length - 1
        ];
      const [, start, end] = lastCall as [string, Date, Date];

      expect(start.toISOString()).toBe(expectedStart);
      expect(end.toISOString()).toBe('2026-08-16T00:00:00.000Z');
      expect(result).toEqual(
        expect.objectContaining({
          period,
          timezone: 'UTC',
          dateFrom: expectedStart.slice(0, 10),
          dateTo: '2026-08-15',
        }),
      );
      expect(result.series).toHaveLength(rows);
      expect(result.series[0]).not.toHaveProperty('resolved');
    }
  });

  afterEach(() => {
    jest.useRealTimers();
  });
});
