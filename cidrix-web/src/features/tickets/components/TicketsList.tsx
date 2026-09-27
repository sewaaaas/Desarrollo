import { Link, useLocation } from 'react-router'
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/features/tickets/components/TicketBadge'
import type { Ticket } from '@/features/tickets/model/ticket.types'

const formatter = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : formatter.format(date)
}

export function TicketsList({ tickets }: { tickets: Ticket[] }) {
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}`

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase tracking-wide text-foreground-muted">
            <tr>
              <th className="px-4 py-3 font-semibold" scope="col">Número</th>
              <th className="px-4 py-3 font-semibold" scope="col">Título</th>
              <th className="px-4 py-3 font-semibold" scope="col">Estado</th>
              <th className="px-4 py-3 font-semibold" scope="col">Prioridad</th>
              <th className="px-4 py-3 font-semibold" scope="col">Categoría</th>
              <th className="px-4 py-3 font-semibold" scope="col">Creado por</th>
              <th className="px-4 py-3 font-semibold" scope="col">Asignado a</th>
              <th className="px-4 py-3 font-semibold" scope="col">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tickets.map((ticket) => (
              <tr className="hover:bg-surface-muted/60" key={ticket.id}>
                <td className="whitespace-nowrap px-4 py-3">
                  <Link
                    className="font-semibold text-primary hover:underline"
                    state={{ from: returnTo }}
                    to={`/tickets/${ticket.id}`}
                  >
                    {ticket.ticketNumber}
                  </Link>
                </td>
                <td className="max-w-72 px-4 py-3">
                  <Link
                    className="block truncate font-medium text-foreground hover:text-primary"
                    state={{ from: returnTo }}
                    title={ticket.title}
                    to={`/tickets/${ticket.id}`}
                  >
                    {ticket.title}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3"><TicketStatusBadge status={ticket.status} /></td>
                <td className="whitespace-nowrap px-4 py-3"><TicketPriorityBadge priority={ticket.priority} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground-muted">{ticket.category?.name ?? 'Sin categoría'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground-muted">{ticket.createdBy.fullName}</td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground-muted">{ticket.assignedTo?.fullName ?? 'Sin asignar'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-foreground-muted">{formatDate(ticket.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {tickets.map((ticket) => (
          <li className="p-4" key={ticket.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  className="text-sm font-semibold text-primary hover:underline"
                  state={{ from: returnTo }}
                  to={`/tickets/${ticket.id}`}
                >
                  {ticket.ticketNumber}
                </Link>
                <Link
                  className="mt-1 block font-semibold text-foreground"
                  state={{ from: returnTo }}
                  to={`/tickets/${ticket.id}`}
                >
                  {ticket.title}
                </Link>
              </div>
              <TicketPriorityBadge priority={ticket.priority} />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <TicketStatusBadge status={ticket.status} />
              <time className="text-xs text-foreground-muted" dateTime={ticket.createdAt}>
                {formatDate(ticket.createdAt)}
              </time>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
