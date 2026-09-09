import { http } from '@/lib/http'

export interface AwaitingReply {
  lead_id: string
  contact_point_id: string
  company_id: string
  company_name: string
  phone_display: string
  phone_e164: string
  email: string | null
  city: string | null
  state: string | null
  segment_name: string | null
  emailed_at: string
  days_since_email: number
  whatsapp_sent: boolean
  open_dispatch_id: string | null
}

export interface FollowupPreparation {
  dispatch_id: string
  company_name: string
  phone_display: string
  rendered_body: string
  whatsapp_link: string
  images: { id: string; url: string; filename: string }[]
}

export const followupApi = {
  list: (minDays: number) =>
    http.get<{ data: AwaitingReply[] }>(`/awaiting-reply?min_days=${minDays}`),

  /** Reserves the WhatsApp follow-up and renders the message. Nothing is
   * written to history yet: opening a chat is not the same as sending. */
  prepare: (leadId: string, templateVersionId: string) =>
    http.post<FollowupPreparation>(`/leads/${leadId}/followup`, {
      template_version_id: templateVersionId,
    }),

  /** Only after the user confirms they actually pressed send. */
  confirm: (
    dispatchId: string,
    body: {
      template_version_id: string
      rendered_body: string
      company_name: string
      template_name: string
    },
  ) => http.post(`/followups/${dispatchId}/confirm`, body),

  cancel: (dispatchId: string) => http.post(`/followups/${dispatchId}/cancel`),

  /** The business answered: it leaves the follow-up list for good. */
  markReplied: (contactPointId: string, note?: string) =>
    http.post(`/contact-points/${contactPointId}/replied`, { note }),
}
