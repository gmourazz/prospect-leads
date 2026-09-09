import { useState } from 'react'
import { Check, Ban, MessageCircleReply, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDateTime } from '@/lib/format'
import { contactBadge } from '../model/contact-badge'
import type { ContactState } from '@/types/domain'
import { ContactHistoryTooltip } from './ContactHistoryTooltip'

const ICONS = { success: Check, warning: MessageCircleReply, danger: Ban, neutral: Clock, info: Clock }

export function ContactStatusBadge({ contact }: { contact: ContactState }) {
  const [open, setOpen] = useState(false)
  const spec = contactBadge(contact)
  const Icon = ICONS[spec.tone]

  const hasHistory = contact.contact_count > 0 || contact.is_suppressed

  const badge = (
    <Badge variant={spec.tone === 'neutral' ? 'neutral' : spec.tone}>
      <Icon />
      {spec.label}
    </Badge>
  )

  if (!hasHistory) return badge

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <span className="cursor-default">{badge}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="w-64 p-0">
        {contact.is_suppressed ? (
          <div className="p-3">
            <p className="font-medium text-danger">Não contatar</p>
            <p className="mt-0.5 text-muted-foreground">
              {contact.suppression_reason ?? 'Bloqueado manualmente'}
            </p>
          </div>
        ) : (
          <div className="p-3">
            <p className="font-medium">
              {contact.contact_count === 1
                ? 'Mensagem enviada'
                : `${contact.contact_count} contatos realizados`}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {contact.last_contacted_at
                ? `Última em ${formatDateTime(contact.last_contacted_at)}`
                : ''}
            </p>
            {open && contact.contact_point_id && contact.contact_count > 0 && (
              <ContactHistoryTooltip contactPointId={contact.contact_point_id} />
            )}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
