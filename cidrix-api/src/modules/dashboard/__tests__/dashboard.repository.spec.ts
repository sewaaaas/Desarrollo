import 'reflect-metadata';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { ACTIVE_WORKLOAD_STATUSES } from '../dashboard.constants';
import { DashboardRepository } from '../dashboard.repository';

describe('DashboardRepository', () => {
  let repository: DashboardRepository;
  let prisma: {
    ticket: { groupBy: jest.Mock };
    category: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      ticket: { groupBy: jest.fn().mockResolvedValue([]) },
      category: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    repository = new DashboardRepository(prisma as unknown as PrismaService);
  });

  it('aplica organizationId a groupBy de status, priority y category', async () => {
    await repository.getStatusGroups('org-a');
    await repository.getPriorityGroups('org-a');
    await repository.getCategoryGroups('org-a');

    expect(prisma.ticket.groupBy).toHaveBeenNthCalledWith(1, {
      by: ['status'],
      where: { organizationId: 'org-a' },
      _count: { _all: true },
    });
    expect(prisma.ticket.groupBy).toHaveBeenNthCalledWith(2, {
      by: ['priority'],
      where: { organizationId: 'org-a' },
      _count: { _all: true },
    });
    expect(prisma.ticket.groupBy).toHaveBeenNthCalledWith(3, {
      by: ['categoryId'],
      where: { organizationId: 'org-a' },
      _count: { _all: true },
    });
  });

  it('workload filtra tenant y exclusivamente OPEN, IN_PROGRESS y PENDING', async () => {
    await repository.getWorkloadGroups('org-a');

    expect(prisma.ticket.groupBy).toHaveBeenCalledWith({
      by: ['assignedToId', 'status'],
      where: {
        organizationId: 'org-a',
        status: { in: [...ACTIVE_WORKLOAD_STATUSES] },
      },
      _count: { _all: true },
    });
    expect(ACTIVE_WORKLOAD_STATUSES).toEqual([
      TicketStatus.OPEN,
      TicketStatus.IN_PROGRESS,
      TicketStatus.PENDING,
    ]);
    expect(ACTIVE_WORKLOAD_STATUSES).not.toContain(TicketStatus.RESOLVED);
  });

  it('resuelve categorías y usuarios con organizationId + ids y campos mínimos', async () => {
    await repository.findCategories('org-a', ['category-1']);
    await repository.findAssignees('org-a', ['user-1']);

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-a', id: { in: ['category-1'] } },
      select: {
        id: true,
        name: true,
        isActive: true,
        deletedAt: true,
      },
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-a', id: { in: ['user-1'] } },
      select: {
        id: true,
        fullName: true,
        role: true,
        status: true,
      },
    });
  });

  it('omite lookups cuando no existen IDs', async () => {
    await expect(repository.findCategories('org-a', [])).resolves.toEqual([]);
    await expect(repository.findAssignees('org-a', [])).resolves.toEqual([]);

    expect(prisma.category.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('promedios usan SQL tagged parametrizado e incluyen organizationId', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        resolutionSampleCount: 2,
        averageResolutionSeconds: 120.4,
        closureSampleCount: 1,
        averageClosureSeconds: 300.2,
      },
    ]);

    await expect(repository.getResolutionAverages('org-a')).resolves.toEqual({
      resolutionSampleCount: 2,
      averageResolutionSeconds: 120.4,
      closureSampleCount: 1,
      averageClosureSeconds: 300.2,
    });

    const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(strings.join('?')).toContain('"organization_id" = ?');
    expect(strings.join('?')).toContain('"resolved_at" - "created_at"');
    expect(strings.join('?')).toContain('"closed_at" - "created_at"');
    expect(values).toEqual(['org-a']);
  });

  it('promedios retornan cero/null si PostgreSQL no devuelve fila', async () => {
    await expect(repository.getResolutionAverages('org-a')).resolves.toEqual({
      resolutionSampleCount: 0,
      averageResolutionSeconds: null,
      closureSampleCount: 0,
      averageClosureSeconds: null,
    });
  });

  it('trends usa generate_series, rango semiabierto, tenant parametrizado y nunca resolved', async () => {
    const start = new Date('2026-08-09T00:00:00.000Z');
    const end = new Date('2026-08-16T00:00:00.000Z');

    await repository.getTrendRows('org-a', start, end);

    const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    const sql = strings.join('?');
    expect(sql).toContain('generate_series');
    expect(sql).toContain(
      '"created_at" >= (?::timestamptz AT TIME ZONE \'UTC\')',
    );
    expect(sql).toContain(
      '"created_at" < (?::timestamptz AT TIME ZONE \'UTC\')',
    );
    expect(sql).toContain(
      '"closed_at" >= (?::timestamptz AT TIME ZONE \'UTC\')',
    );
    expect(sql).toContain(
      '"closed_at" < (?::timestamptz AT TIME ZONE \'UTC\')',
    );
    expect(sql).toContain('ORDER BY "days"."day" ASC');
    expect(sql.toLowerCase()).not.toContain('resolved');
    expect(values.filter((value) => value === 'org-a')).toHaveLength(2);
    expect(values).toContain(start);
    expect(values).toContain(end);
  });
});
