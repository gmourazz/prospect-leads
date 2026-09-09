import { useState } from 'react'
import { Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { formatDate, formatDateTime } from '@/lib/format'
import { LEAD_STATUS_LABELS, WEBSITE_STATUS_LABELS, type Lead } from '@/types/domain'
import { useContactEvents, useUpdateContactEmail } from '../hooks/useLeads'

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

export function LeadDetailDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: Lead
}) {
  const { data: history, isLoading } = useContactEvents(
    open ? lead.contact.contact_point_id : null,
  )
  const [editingEmail, setEditingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState(lead.contact.email ?? '')
  const updateEmail = useUpdateContactEmail()
  const contactId = lead.contact.contact_point_id

  function saveEmail() {
    if (!contactId) return
    updateEmail.mutate(
      { id: contactId, email: emailDraft.trim() },
      { onSuccess: () => setEditingEmail(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead.company.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            <Field label="Status do lead">
              <Badge variant="outline">{LEAD_STATUS_LABELS[lead.status]}</Badge>
            </Field>
            <Field label="Site próprio">
              <Badge variant="outline">{WEBSITE_STATUS_LABELS[lead.company.website_status]}</Badge>
            </Field>
            <Field label="Cidade">{lead.company.city ? `${lead.company.city}/${lead.company.state}` : '—'}</Field>
            <Field label="Segmento">{lead.segment?.name ?? '—'}</Field>
            <Field label="Telefone">
              <span className="font-mono">{lead.contact.phone_display}</span>
            </Field>
            <Field label="Coletado em">{formatDate(lead.collected_at)}</Field>
            <Field label="Email">
              {editingEmail ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    className="h-7 text-[13px]"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    placeholder="contato@empresa.com"
                    onKeyDown={(e) => e.key === 'Enter' && saveEmail()}
                  />
                  <Button size="sm" onClick={saveEmail} loading={updateEmail.isPending}>
                    Salvar
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingEmail(true)}
                  className="group flex items-center gap-1.5 text-left"
                >
                  <span className={lead.contact.email ? '' : 'text-muted-foreground'}>
                    {lead.contact.email ?? 'sem email — clique para adicionar'}
                  </span>
                  <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </button>
              )}
            </Field>
          </div>

          {lead.notes && (
            <div className="rounded-md bg-muted px-3 py-2 text-[13px]">{lead.notes}</div>
          )}

          <Separator />

          <div>
            <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
              Histórico de contato
            </p>
            {isLoading ? (
              <p className="text-[13px] text-muted-foreground">Carregando…</p>
            ) : !history || history.events.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Nenhum contato registrado ainda.</p>
            ) : (
              <ul className="scrollbar-thin max-h-64 space-y-2 overflow-y-auto text-[13px]">
                {history.events.map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium">{EVENT_LABELS[event.type] ?? event.type}</p>
                      {event.snapshot.template_name && (
                        <p className="text-[12px] text-muted-foreground">
                          Template: {event.snapshot.template_name}
                        </p>
                      )}
                      {event.note && <p className="text-[12px] text-muted-foreground">{event.note}</p>}
                    </div>
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {formatDateTime(event.occurred_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}
