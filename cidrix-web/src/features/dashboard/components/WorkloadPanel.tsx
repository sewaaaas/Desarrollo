import { USER_STATUS_LABELS } from '@/features/dashboard/model/dashboard.constants'
import type { DashboardOverview } from '@/features/dashboard/model/dashboard.types'
import { TICKET_STATUS_LABELS } from '@/features/tickets/model/ticket.constants'
import { Card } from '@/shared/components/Card'

interface WorkloadPanelProps {
  workload: DashboardOverview['assigneeWorkload']
}

function UserStatusBadge({ status }: { status: keyof typeof USER_STATUS_LABELS }) {
  if (status === 'ACTIVE') return <span className="text-sm text-foreground-muted">Activo</span>

  return (
    <span className="rounded-full bg-surface-muted px-2 py-1 text-xs font-medium text-foreground-muted">
      {USER_STATUS_LABELS[status]}
    </span>
  )
}

export function WorkloadPanel({ workload }: WorkloadPanelProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-6">
        <div>
          <h2 className="text-lg font-bold text-foreground">Carga por técnico</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Tickets abiertos, en progreso o pendientes.
          </p>
        </div>
        <div className="rounded-control bg-primary/10 px-3 py-2 text-sm text-primary">
          <span className="font-medium">Sin asignar:</span>{' '}
          <strong className="tabular-nums">{workload.unassignedTickets}</strong>
        </div>
      </div>

      {workload.assignees.length === 0 ? (
        <p className="p-6 text-sm text-foreground-muted">
          No hay tickets activos asignados.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-surface-muted text-foreground-muted">
                <tr>
                  <th className="px-6 py-3 font-semibold" scope="col">Técnico</th>
                  <th className="px-4 py-3 text-right font-semibold" scope="col">Tickets activos</th>
                  {workload.activeStatuses.map((status) => (
                    <th className="px-4 py-3 text-right font-semibold" key={status} scope="col">
                      {TICKET_STATUS_LABELS[status]}
                    </th>
                  ))}
                  <th className="px-6 py-3 font-semibold" scope="col">Estado del usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {workload.assignees.map((assignee) => (
                  <tr key={assignee.assigneeId}>
                    <th className="px-6 py-4 font-medium text-foreground" scope="row">
                      {assignee.assigneeName}
                    </th>
                    <td className="px-4 py-4 text-right font-bold tabular-nums text-foreground">
                      {assignee.activeTickets}
                    </td>
                    {workload.activeStatuses.map((status) => (
                      <td className="px-4 py-4 text-right tabular-nums text-foreground-muted" key={status}>
                        {assignee.byStatus[status]}
                      </td>
                    ))}
                    <td className="px-6 py-4"><UserStatusBadge status={assignee.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-border md:hidden">
            {workload.assignees.map((assignee) => (
              <li className="p-5" key={assignee.assigneeId}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{assignee.assigneeName}</p>
                    <div className="mt-1"><UserStatusBadge status={assignee.status} /></div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-foreground-muted">Activos</p>
                    <p className="text-xl font-bold tabular-nums text-foreground">
                      {assignee.activeTickets}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2">
                  {workload.activeStatuses.map((status) => (
                    <div className="rounded-control bg-surface-muted p-2 text-center" key={status}>
                      <dt className="text-xs text-foreground-muted">{TICKET_STATUS_LABELS[status]}</dt>
                      <dd className="mt-1 font-semibold tabular-nums text-foreground">
                        {assignee.byStatus[status]}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
