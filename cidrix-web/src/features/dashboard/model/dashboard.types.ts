import type { UserRole } from '@/features/auth/model/auth.types'
import type {
  TicketPriority,
  TicketStatus,
} from '@/features/tickets/model/ticket.types'

export type DashboardPeriod = '7d' | '30d' | '90d'
export type DashboardUserStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED'
export type ActiveWorkloadStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING'

export type TicketStatusCounts = Record<TicketStatus, number>
export type TicketPriorityCounts = Record<TicketPriority, number>
export type ActiveWorkloadStatusCounts = Record<ActiveWorkloadStatus, number>

export interface DashboardCategoryMetric {
  categoryId: string | null
  categoryName: string
  isActive: boolean
  isDeleted: boolean
  count: number
}

export interface DashboardAssigneeMetric {
  assigneeId: string
  assigneeName: string
  role: UserRole
  status: DashboardUserStatus
  activeTickets: number
  byStatus: ActiveWorkloadStatusCounts
}

export interface DashboardOverview {
  summary: {
    total: number
    byStatus: TicketStatusCounts
  }
  byPriority: TicketPriorityCounts
  byCategory: DashboardCategoryMetric[]
  assigneeWorkload: {
    activeStatuses: ActiveWorkloadStatus[]
    unassignedTickets: number
    assignees: DashboardAssigneeMetric[]
  }
  resolutionTime: {
    resolutionSampleCount: number
    averageResolutionSeconds: number | null
    closureSampleCount: number
    averageClosureSeconds: number | null
  }
}

export interface DashboardTrendItem {
  date: string
  created: number
  closed: number
}

export interface DashboardTrends {
  period: DashboardPeriod
  timezone: 'UTC'
  dateFrom: string
  dateTo: string
  series: DashboardTrendItem[]
}
