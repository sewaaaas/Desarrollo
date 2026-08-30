import {
  TicketPriority,
  TicketStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { ActiveWorkloadStatus, DashboardPeriod } from '../dashboard.constants';

export type TicketStatusCounts = Record<TicketStatus, number>;
export type TicketPriorityCounts = Record<TicketPriority, number>;
export type ActiveWorkloadStatusCounts = Record<ActiveWorkloadStatus, number>;

export class DashboardSummaryDto {
  total!: number;
  byStatus!: TicketStatusCounts;
}

export class DashboardCategoryMetricDto {
  categoryId!: string | null;
  categoryName!: string;
  isActive!: boolean;
  isDeleted!: boolean;
  count!: number;
}

export class DashboardAssigneeMetricDto {
  assigneeId!: string;
  assigneeName!: string;
  role!: UserRole;
  status!: UserStatus;
  activeTickets!: number;
  byStatus!: ActiveWorkloadStatusCounts;
}

export class DashboardAssigneeWorkloadDto {
  activeStatuses!: ActiveWorkloadStatus[];
  unassignedTickets!: number;
  assignees!: DashboardAssigneeMetricDto[];
}

export class DashboardResolutionTimeDto {
  resolutionSampleCount!: number;
  averageResolutionSeconds!: number | null;
  closureSampleCount!: number;
  averageClosureSeconds!: number | null;
}

export class DashboardOverviewResponseDto {
  summary!: DashboardSummaryDto;
  byPriority!: TicketPriorityCounts;
  byCategory!: DashboardCategoryMetricDto[];
  assigneeWorkload!: DashboardAssigneeWorkloadDto;
  resolutionTime!: DashboardResolutionTimeDto;
}

export class DashboardTrendItemDto {
  date!: string;
  created!: number;
  closed!: number;
}

export class DashboardTrendsResponseDto {
  period!: DashboardPeriod;
  timezone!: 'UTC';
  dateFrom!: string;
  dateTo!: string;
  series!: DashboardTrendItemDto[];
}
