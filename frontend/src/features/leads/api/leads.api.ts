import { http } from '@/lib/http'
import type { ContactEvent, ContactState, Lead, LeadCounts, LeadFilters } from '@/types/domain'

export interface LeadListResponse {
  data: Lead[]
  meta: { counts: LeadCounts; limit: number; offset: number }
}

function toQuery(filters: LeadFilters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  return params.toString()
}

export const leadsApi = {
  list: (filters: LeadFilters, signal?: AbortSignal) =>
    http.get<LeadListResponse>(`/leads?${toQuery(filters)}`, signal),

  get: (id: string) => http.get<Lead>(`/leads/${id}`),

  updateStatus: (id: string, body: { status?: string; notes?: string | null }) =>
    http.patch<Lead>(`/leads/${id}`, body),

  remove: (id: string) => http.del<{ status: string }>(`/leads/${id}`),

  create: (body: Record<string, unknown>) => http.post<Lead>('/leads', body),

  cities: () => http.get<{ data: string[] }>('/leads/cities'),

  /** Bulk selection is resolved server-side: page 1 of 50 cannot know all 80 eligible rows. */
  resolveSelection: (filters: LeadFilters, onlyAvailable: boolean) =>
    http.post<{ lead_ids: string[]; count: number }>('/leads/selection', {
      filters: Object.fromEntries(
        Object.entries(filters).map(([k, v]) => [k, v === undefined ? '' : String(v)]),
      ),
      only_available: onlyAvailable,
      limit: 5000,
    }),

  contactEvents: (contactPointId: string) =>
    http.get<{ contact: ContactState; events: ContactEvent[] }>(
      `/contact-points/${contactPointId}/events`,
    ),

  suppress: (contactPointId: string, reason: string, note?: string) =>
    http.post(`/contact-points/${contactPointId}/suppressions`, { reason, note }),

  unsuppress: (contactPointId: string, reason: string) =>
    http.del(`/contact-points/${contactPointId}/suppressions`, { reason }),

  markInterested: (contactPointId: string, note?: string) =>
    http.post(`/contact-points/${contactPointId}/interest`, { note }),

  unmarkInterested: (contactPointId: string) =>
    http.del(`/contact-points/${contactPointId}/interest`),

  approveRecontact: (contactPointId: string, reason: string) =>
    http.post<{ approval_id: string; previous_contacts: ContactEvent[] }>(
      `/contact-points/${contactPointId}/recontact-approvals`,
      { reason },
    ),

  /** Starts background discovery of public emails for leads that have
   * none. Returns as soon as the work is queued, not when it finishes. */
  enrichEmails: (limit = 200) =>
    http.post<{ queued: number }>('/leads/enrich-emails', { limit }),

  /** Polled while discovery runs so the screen can show how far it got. */
  enrichProgress: () => http.get<EnrichProgress>('/leads/enrich-emails/progress'),

  /** Fixes or fills in an email discovery couldn't find. */
  updateEmail: (contactPointId: string, email: string) =>
    http.patch(`/contact-points/${contactPointId}`, { email }),
}

export interface EnrichProgress {
  running: boolean
  total: number
  processed: number
  /** Leads still without any email, counted in the database. */
  remaining: number
  leads_with_email: number
  emails_found: number
  started_at?: string
  finished_at?: string
}
