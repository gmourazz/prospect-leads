import type { ContactState } from '@/types/domain'

export type ContactBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export interface ContactBadgeSpec {
  label: string
  tone: ContactBadgeTone
}

/**
 * Single source of truth for how a contact's state renders. The check is a
 * READ of contact_count from the server-derived history — never a flag this
 * function sets.
 */
export function contactBadge(contact: ContactState): ContactBadgeSpec {
  if (!contact.contact_point_id) return { label: 'Sem contato', tone: 'neutral' }
  if (contact.is_suppressed) return { label: 'Não contatar', tone: 'danger' }
  if (contact.status === 'replied') return { label: 'Respondeu', tone: 'warning' }
  if (contact.contact_count > 1) return { label: `${contact.contact_count} contatos`, tone: 'success' }
  if (contact.contact_count === 1) return { label: 'Enviado', tone: 'success' }
  // A failed dispatch never bumps contact_count — without this, a number
  // with no WhatsApp looks identical to one nobody ever tried.
  if (contact.has_error) return { label: 'Falhou', tone: 'danger' }
  return { label: 'Disponível', tone: 'neutral' }
}

export const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
}
