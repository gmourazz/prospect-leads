import { useState } from 'react'
import {
  Eye,
  MessageCircle,
  MoreHorizontal,
  RotateCcw,
  ShieldBan,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Textarea } from '@/components/ui/input'
import { formatDateTime } from '@/lib/format'
import type { Lead } from '@/types/domain'
import { cn } from '@/lib/cn'
import {
  useDeleteLead,
  useMarkInterested,
  useSuppressContact,
  useUnmarkInterested,
  useUnsuppressContact,
} from '../hooks/useLeads'
import { RecontactDialog } from './RecontactDialog'
import { LeadDetailDialog } from './LeadDetailDialog'
import { SendWhatsAppDialog } from './SendWhatsAppDialog'

export function LeadRowActions({ lead }: { lead: Lead }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [suppressOpen, setSuppressOpen] = useState(false)
  const [recontactOpen, setRecontactOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [note, setNote] = useState('')

  const deleteLead = useDeleteLead()
  const suppress = useSuppressContact()
  const unsuppress = useUnsuppressContact()

  const contactId = lead.contact.contact_point_id
  const alreadyContacted = lead.contact.contact_count > 0

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Ações">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDetailOpen(true)}>
            <Eye />
            Ver lead
          </DropdownMenuItem>
          {contactId && !lead.contact.email && !lead.contact.is_suppressed && (
            <DropdownMenuItem onSelect={() => setWhatsappOpen(true)}>
              <MessageCircle />
              Chamar no WhatsApp
            </DropdownMenuItem>
          )}
          {contactId && alreadyContacted && !lead.contact.is_suppressed && (
            <DropdownMenuItem onSelect={() => setRecontactOpen(true)}>
              <RotateCcw />
              Enviar novamente
            </DropdownMenuItem>
          )}
          {contactId && !lead.contact.is_suppressed && (
            <DropdownMenuItem onSelect={() => setSuppressOpen(true)}>
              <ShieldBan />
              Não contatar
            </DropdownMenuItem>
          )}
          {contactId && lead.contact.is_suppressed && (
            <DropdownMenuItem onSelect={() => unsuppress.mutate({ id: contactId, reason: 'manual' })}>
              <ShieldCheck />
              Remover bloqueio
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
            <Trash2 />
            Remover lead
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LeadDetailDialog open={detailOpen} onOpenChange={setDetailOpen} lead={lead} />

      <SendWhatsAppDialog open={whatsappOpen} onOpenChange={setWhatsappOpen} lead={lead} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Remover este lead?"
        description="O histórico de contato deste telefone é preservado — se ele reaparecer em uma nova coleta, o sistema ainda vai reconhecer que já foi contatado."
        confirmLabel="Remover"
        variant="danger"
        loading={deleteLead.isPending}
        onConfirm={() => deleteLead.mutate(lead.id, { onSuccess: () => setDeleteOpen(false) })}
      />

      <ConfirmDialog
        open={suppressOpen}
        onOpenChange={setSuppressOpen}
        title="Bloquear este número?"
        description="Ele nunca mais entrará em um lote de envio, mesmo em novas coletas ou importações — em nenhum segmento."
        confirmLabel="Bloquear"
        variant="danger"
        loading={suppress.isPending}
        onConfirm={() =>
          contactId &&
          suppress.mutate(
            { id: contactId, reason: note || 'manual' },
            { onSuccess: () => setSuppressOpen(false) },
          )
        }
      >
        <Textarea
          placeholder="Motivo (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </ConfirmDialog>

      {contactId && (
        <RecontactDialog
          open={recontactOpen}
          onOpenChange={setRecontactOpen}
          contactPointId={contactId}
          lastContactedAt={lead.contact.last_contacted_at}
          contactCount={lead.contact.contact_count}
        />
      )}
    </>
  )
}

export function InterestToggle({ lead }: { lead: Lead }) {
  const contactId = lead.contact.contact_point_id
  const markInterested = useMarkInterested()
  const unmarkInterested = useUnmarkInterested()

  if (!contactId) return null

  const isInterested = lead.contact.is_interested
  const pending = markInterested.isPending || unmarkInterested.isPending

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={isInterested ? 'Remover interesse' : 'Marcar como interessado'}
      title={isInterested ? 'Remover interesse' : 'Marcar como interessado'}
      disabled={pending}
      onClick={() =>
        isInterested ? unmarkInterested.mutate(contactId) : markInterested.mutate({ id: contactId })
      }
    >
      <Star className={cn(isInterested && 'fill-warning text-warning')} />
    </Button>
  )
}

export { formatDateTime }
