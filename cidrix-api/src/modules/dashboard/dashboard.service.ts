import { Injectable } from '@nestjs/common';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { RequestUser } from '@modules/auth/types/jwt-payload.type';
import {
  ACTIVE_WORKLOAD_STATUSES,
  ActiveWorkloadStatus,
  DASHBOARD_PERIOD_DAYS,
  DashboardPeriod,
} from './dashboard.constants';
import {
  DashboardAssigneeMetricDto,
  DashboardCategoryMetricDto,
  DashboardOverviewResponseDto,
  DashboardTrendsResponseDto,
  TicketPriorityCounts,
  TicketStatusCounts,
} from './dto/dashboard-response.dto';
import {
  DashboardAssigneeRecord,
  DashboardCategoryRecord,
  DashboardRepository,
  DashboardWorkloadGroup,
} from './dashboard.repository';

type ActiveDashboardWorkloadGroup = Omit<DashboardWorkloadGroup, 'status'> & {
  status: ActiveWorkloadStatus;
};

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async getOverview(
    currentUser: RequestUser,
  ): Promise<DashboardOverviewResponseDto> {
    const organizationId = currentUser.organizationId;
    const [
      statusGroups,
      priorityGroups,
      categoryGroups,
      workloadGroups,
      resolutionTime,
    ] = await Promise.all([
      this.repository.getStatusGroups(organizationId),
      this.repository.getPriorityGroups(organizationId),
      this.repository.getCategoryGroups(organizationId),
      this.repository.getWorkloadGroups(organizationId),
      this.repository.getResolutionAverages(organizationId),
    ]);

    const activeWorkloadGroups = workloadGroups.filter(
      (group): group is ActiveDashboardWorkloadGroup =>
        this.isActiveWorkloadStatus(group.status),
    );

    const categoryIds = categoryGroups
      .map((group) => group.categoryId)
      .filter((id): id is string => id !== null);
    const assigneeIds = activeWorkloadGroups
      .map((group) => group.assignedToId)
      .filter((id): id is string => id !== null);
    const [categories, assignees] = await Promise.all([
      this.repository.findCategories(organizationId, [...new Set(categoryIds)]),
      this.repository.findAssignees(organizationId, [...new Set(assigneeIds)]),
    ]);

    const byStatus = this.emptyStatusCounts();
    for (const group of statusGroups) {
      byStatus[group.status] = group._count._all;
    }

    const byPriority = this.emptyPriorityCounts();
    for (const group of priorityGroups) {
      byPriority[group.priority] = group._count._all;
    }

    return {
      summary: {
        total: Object.values(byStatus).reduce(
          (total, count) => total + count,
          0,
        ),
        byStatus,
      },
      byPriority,
      byCategory: this.buildCategoryMetrics(categoryGroups, categories),
      assigneeWorkload: {
        activeStatuses: [...ACTIVE_WORKLOAD_STATUSES],
        unassignedTickets: activeWorkloadGroups
          .filter((group) => group.assignedToId === null)
          .reduce((total, group) => total + group._count._all, 0),
        assignees: this.buildAssigneeMetrics(activeWorkloadGroups, assignees),
      },
      resolutionTime: {
        resolutionSampleCount: resolutionTime.resolutionSampleCount,
        averageResolutionSeconds: this.normalizeAverage(
          resolutionTime.averageResolutionSeconds,
        ),
        closureSampleCount: resolutionTime.closureSampleCount,
        averageClosureSeconds: this.normalizeAverage(
          resolutionTime.averageClosureSeconds,
        ),
      },
    };
  }

  async getTrends(
    currentUser: RequestUser,
    period: DashboardPeriod,
  ): Promise<DashboardTrendsResponseDto> {
    const { start, end, dateFrom, dateTo } = this.getUtcRange(period);
    const rows = await this.repository.getTrendRows(
      currentUser.organizationId,
      start,
      end,
    );

    return {
      period,
      timezone: 'UTC',
      dateFrom,
      dateTo,
      series: rows.map((row) => ({
        date: row.date,
        created: row.created,
        closed: row.closed,
      })),
    };
  }

  private buildCategoryMetrics(
    groups: Array<{ categoryId: string | null; _count: { _all: number } }>,
    categories: DashboardCategoryRecord[],
  ): DashboardCategoryMetricDto[] {
    const requestedIds = new Set(
      groups
        .map((group) => group.categoryId)
        .filter((id): id is string => id !== null),
    );
    const categoryById = new Map(
      categories
        .filter((category) => requestedIds.has(category.id))
        .map((category) => [category.id, category]),
    );
    const metrics: DashboardCategoryMetricDto[] = [];

    for (const group of groups) {
      if (group._count._all <= 0) {
        continue;
      }

      if (group.categoryId === null) {
        metrics.push({
          categoryId: null,
          categoryName: 'Sin categoría',
          isActive: false,
          isDeleted: false,
          count: group._count._all,
        });
        continue;
      }

      const category = categoryById.get(group.categoryId);
      if (!category) {
        continue;
      }

      metrics.push({
        categoryId: category.id,
        categoryName: category.name,
        isActive: category.isActive,
        isDeleted: category.deletedAt !== null,
        count: group._count._all,
      });
    }

    return metrics.sort(
      (left, right) =>
        right.count - left.count ||
        this.compareStrings(left.categoryName, right.categoryName) ||
        this.compareStrings(left.categoryId ?? '', right.categoryId ?? ''),
    );
  }

  private buildAssigneeMetrics(
    groups: ActiveDashboardWorkloadGroup[],
    assignees: DashboardAssigneeRecord[],
  ): DashboardAssigneeMetricDto[] {
    const requestedIds = new Set(
      groups
        .map((group) => group.assignedToId)
        .filter((id): id is string => id !== null),
    );
    const metrics: DashboardAssigneeMetricDto[] = [];

    for (const assignee of assignees) {
      if (!requestedIds.has(assignee.id)) {
        continue;
      }

      const assigneeGroups = groups.filter(
        (group) => group.assignedToId === assignee.id,
      );
      if (assigneeGroups.length === 0) {
        continue;
      }

      const byStatus = this.emptyWorkloadStatusCounts();
      for (const group of assigneeGroups) {
        byStatus[group.status] += group._count._all;
      }

      metrics.push({
        assigneeId: assignee.id,
        assigneeName: assignee.fullName,
        role: assignee.role,
        status: assignee.status,
        activeTickets: Object.values(byStatus).reduce(
          (total, count) => total + count,
          0,
        ),
        byStatus,
      });
    }

    return metrics.sort(
      (left, right) =>
        right.activeTickets - left.activeTickets ||
        this.compareStrings(left.assigneeName, right.assigneeName) ||
        this.compareStrings(left.assigneeId, right.assigneeId),
    );
  }

  private emptyStatusCounts(): TicketStatusCounts {
    return {
      [TicketStatus.OPEN]: 0,
      [TicketStatus.IN_PROGRESS]: 0,
      [TicketStatus.PENDING]: 0,
      [TicketStatus.RESOLVED]: 0,
      [TicketStatus.CLOSED]: 0,
      [TicketStatus.CANCELLED]: 0,
    };
  }

  private emptyPriorityCounts(): TicketPriorityCounts {
    return {
      [TicketPriority.LOW]: 0,
      [TicketPriority.MEDIUM]: 0,
      [TicketPriority.HIGH]: 0,
      [TicketPriority.CRITICAL]: 0,
    };
  }

  private emptyWorkloadStatusCounts(): Record<ActiveWorkloadStatus, number> {
    return {
      [TicketStatus.OPEN]: 0,
      [TicketStatus.IN_PROGRESS]: 0,
      [TicketStatus.PENDING]: 0,
    };
  }

  private getUtcRange(period: DashboardPeriod): {
    start: Date;
    end: Date;
    dateFrom: string;
    dateTo: string;
  } {
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const start = new Date(todayStart);
    start.setUTCDate(start.getUTCDate() - (DASHBOARD_PERIOD_DAYS[period] - 1));
    const end = new Date(todayStart);
    end.setUTCDate(end.getUTCDate() + 1);

    return {
      start,
      end,
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: todayStart.toISOString().slice(0, 10),
    };
  }

  private normalizeAverage(value: number | null): number | null {
    return value !== null && Number.isFinite(value) ? Math.round(value) : null;
  }

  private isActiveWorkloadStatus(
    status: TicketStatus,
  ): status is ActiveWorkloadStatus {
    return ACTIVE_WORKLOAD_STATUSES.some(
      (activeStatus) => activeStatus === status,
    );
  }

  private compareStrings(left: string, right: string): number {
    if (left === right) {
      return 0;
    }
    return left < right ? -1 : 1;
  }
}
