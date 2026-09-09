import { useContactEvents } from '../hooks/useLeads'
import { formatDateTime } from '@/lib/format'

const EVENT_LABELS: Record<string, string> = {
  message_sent: 'Mensagem enviada',
  message_failed: 'Falha no envio',
  replied: 'Respondeu',
  call_made: 'Ligação realizada',
  meeting_scheduled: 'Reunião agendada',
  opted_out: 'Pediu para não contatar',
  manual_note: 'Nota manual',
  imported_seen: 'Reapareceu em importação',
}

/** Lazy-loaded on hover: the board never ships full history per row. */
export function ContactHistoryTooltip({ contactPointId }: { contactPointId: string }) {
  const { data, isLoading } = useContactEvents(contactPointId)

  if (isLoading) return <p className="mt-2 text-muted-foreground">Carregando histórico…</p>
  if (!data || data.events.length === 0) return null

  return (
    <ul className="mt-2 space-y-1.5 border-t border-border pt-2">
      {data.events.slice(0, 4).map((event) => (
        <li key={event.id} className="flex items-center justify-between gap-2">
          <span>
            {EVENT_LABELS[event.type] ?? event.type}
            {event.snapshot.template_name && (
              <span className="text-muted-foreground"> · {event.snapshot.template_name}</span>
            )}
          </span>
          <span className="shrink-0 text-muted-foreground">{formatDateTime(event.occurred_at)}</span>
        </li>
      ))}
    </ul>
  )
}
