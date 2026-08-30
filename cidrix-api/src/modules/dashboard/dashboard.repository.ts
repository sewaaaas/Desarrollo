import { Injectable } from '@nestjs/common';
import {
  TicketPriority,
  TicketStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '@database/prisma.service';
import { ACTIVE_WORKLOAD_STATUSES } from './dashboard.constants';

export interface DashboardStatusGroup {
  status: TicketStatus;
  _count: { _all: number };
}

export interface DashboardPriorityGroup {
  priority: TicketPriority;
  _count: { _all: number };
}

export interface DashboardCategoryGroup {
  categoryId: string | null;
  _count: { _all: number };
}

export interface DashboardWorkloadGroup {
  assignedToId: string | null;
  status: TicketStatus;
  _count: { _all: number };
}

export interface DashboardCategoryRecord {
  id: string;
  name: string;
  isActive: boolean;
  deletedAt: Date | null;
}

export interface DashboardAssigneeRecord {
  id: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}

export interface DashboardResolutionAverages {
  resolutionSampleCount: number;
  averageResolutionSeconds: number | null;
  closureSampleCount: number;
  averageClosureSeconds: number | null;
}

export interface DashboardTrendRow {
  date: string;
  created: number;
  closed: number;
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getStatusGroups(
    organizationId: string,
  ): Promise<DashboardStatusGroup[]> {
    const groups = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { _all: true },
    });
    return groups;
  }

  async getPriorityGroups(
    organizationId: string,
  ): Promise<DashboardPriorityGroup[]> {
    const groups = await this.prisma.ticket.groupBy({
      by: ['priority'],
      where: { organizationId },
      _count: { _all: true },
    });
    return groups;
  }

  async getCategoryGroups(
    organizationId: string,
  ): Promise<DashboardCategoryGroup[]> {
    const groups = await this.prisma.ticket.groupBy({
      by: ['categoryId'],
      where: { organizationId },
      _count: { _all: true },
    });
    return groups;
  }

  async getWorkloadGroups(
    organizationId: string,
  ): Promise<DashboardWorkloadGroup[]> {
    const groups = await this.prisma.ticket.groupBy({
      by: ['assignedToId', 'status'],
      where: {
        organizationId,
        status: { in: [...ACTIVE_WORKLOAD_STATUSES] },
      },
      _count: { _all: true },
    });
    return groups;
  }

  findCategories(
    organizationId: string,
    categoryIds: string[],
  ): Promise<DashboardCategoryRecord[]> {
    if (categoryIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.category.findMany({
      where: { organizationId, id: { in: categoryIds } },
      select: {
        id: true,
        name: true,
        isActive: true,
        deletedAt: true,
      },
    });
  }

  findAssignees(
    organizationId: string,
    assigneeIds: string[],
  ): Promise<DashboardAssigneeRecord[]> {
    if (assigneeIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.prisma.user.findMany({
      where: { organizationId, id: { in: assigneeIds } },
      select: {
        id: true,
        fullName: true,
        role: true,
        status: true,
      },
    });
  }

  async getResolutionAverages(
    organizationId: string,
  ): Promise<DashboardResolutionAverages> {
    const rows = await this.prisma.$queryRaw<DashboardResolutionAverages[]>`
      SELECT
        COUNT(*) FILTER (WHERE "resolved_at" IS NOT NULL)::int
          AS "resolutionSampleCount",
        ROUND(
          AVG(EXTRACT(EPOCH FROM ("resolved_at" - "created_at")))
            FILTER (WHERE "resolved_at" IS NOT NULL)
        )::double precision AS "averageResolutionSeconds",
        COUNT(*) FILTER (WHERE "closed_at" IS NOT NULL)::int
          AS "closureSampleCount",
        ROUND(
          AVG(EXTRACT(EPOCH FROM ("closed_at" - "created_at")))
            FILTER (WHERE "closed_at" IS NOT NULL)
        )::double precision AS "averageClosureSeconds"
      FROM "tickets"
      WHERE "organization_id" = ${organizationId}
    `;

    return (
      rows[0] ?? {
        resolutionSampleCount: 0,
        averageResolutionSeconds: null,
        closureSampleCount: 0,
        averageClosureSeconds: null,
      }
    );
  }

  getTrendRows(
    organizationId: string,
    start: Date,
    end: Date,
  ): Promise<DashboardTrendRow[]> {
    return this.prisma.$queryRaw<DashboardTrendRow[]>`
      WITH "days" AS (
        SELECT generate_series(
          (${start}::timestamptz AT TIME ZONE 'UTC'),
          (${end}::timestamptz AT TIME ZONE 'UTC') - INTERVAL '1 day',
          INTERVAL '1 day'
        ) AS "day"
      ),
      "created_counts" AS (
        SELECT
          date_trunc('day', "created_at") AS "day",
          COUNT(*)::int AS "count"
        FROM "tickets"
        WHERE "organization_id" = ${organizationId}
          AND "created_at" >= (${start}::timestamptz AT TIME ZONE 'UTC')
          AND "created_at" < (${end}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY date_trunc('day', "created_at")
      ),
      "closed_counts" AS (
        SELECT
          date_trunc('day', "closed_at") AS "day",
          COUNT(*)::int AS "count"
        FROM "tickets"
        WHERE "organization_id" = ${organizationId}
          AND "closed_at" >= (${start}::timestamptz AT TIME ZONE 'UTC')
          AND "closed_at" < (${end}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY date_trunc('day', "closed_at")
      )
      SELECT
        to_char("days"."day", 'YYYY-MM-DD') AS "date",
        COALESCE("created_counts"."count", 0)::int AS "created",
        COALESCE("closed_counts"."count", 0)::int AS "closed"
      FROM "days"
      LEFT JOIN "created_counts" ON "created_counts"."day" = "days"."day"
      LEFT JOIN "closed_counts" ON "closed_counts"."day" = "days"."day"
      ORDER BY "days"."day" ASC
    `;
  }
}
