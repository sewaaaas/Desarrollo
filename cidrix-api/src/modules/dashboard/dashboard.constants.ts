import { TicketStatus } from '@prisma/client';

export enum DashboardPeriod {
  SEVEN_DAYS = '7d',
  THIRTY_DAYS = '30d',
  NINETY_DAYS = '90d',
}

export const DASHBOARD_PERIOD_DAYS: Record<DashboardPeriod, number> = {
  [DashboardPeriod.SEVEN_DAYS]: 7,
  [DashboardPeriod.THIRTY_DAYS]: 30,
  [DashboardPeriod.NINETY_DAYS]: 90,
};

export const ACTIVE_WORKLOAD_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING,
] as const;

export type ActiveWorkloadStatus = (typeof ACTIVE_WORKLOAD_STATUSES)[number];
