import { http } from '@/lib/http'
import type { Batch, BatchOutcome, Campaign, CampaignTarget, LeadFilters } from '@/types/domain'

export const campaignsApi = {
  list: () => http.get<{ data: Campaign[] }>('/campaigns'),
  get: (id: string) => http.get<Campaign>(`/campaigns/${id}`),

  create: (body: {
    name: string
    template_version_id: string
    batch_size: number
    filters: Record<string, string>
  }) => http.post<Campaign>('/campaigns', body),

  targets: (id: string, state: string, limit = 100) =>
    http.get<{ data: CampaignTarget[] }>(`/campaigns/${id}/targets?state=${state}&limit=${limit}`),

  batches: (id: string, range?: { from?: string; to?: string }) => {
    const params = new URLSearchParams()
    if (range?.from) params.set('from', range.from)
    if (range?.to) params.set('to', range.to)
    const qs = params.toString()
    return http.get<{ data: Batch[] }>(`/campaigns/${id}/batches${qs ? `?${qs}` : ''}`)
  },

  /** Pausing stops the campaign from being a place to send the next batch
   * from. Nothing already sent changes. */
  setStatus: (id: string, status: 'active' | 'paused' | 'completed') =>
    http.patch<Campaign>(`/campaigns/${id}/status`, { status }),

  /** Removes the campaign only: everything it already sent stays in the
   * contact history, so "já contatei essa empresa" survives. */
  remove: (id: string) => http.del<{ status: string }>(`/campaigns/${id}`),

  /** The Idempotency-Key is generated at the click, so a refresh or double
   * click during processing can never produce a second send. */
  sendBatch: (
    id: string,
    body: { size: number; mode?: 'recontact'; approval_ids?: string[] },
    idempotencyKey: string,
  ) => http.post<BatchOutcome>(`/campaigns/${id}/batches`, body, idempotencyKey),

  preview: (id: string, targetId?: string) =>
    http.post<{
      company_name: string
      email: string | null
      rendered_subject: string
      rendered_body: string
      images: { id: string; url: string; filename: string }[]
      unresolved_variables: string[]
    }>(`/campaigns/${id}/preview`, { target_id: targetId }),
}

export function filtersToQueryRecord(filters: LeadFilters): Record<string, string> {
  const record: Record<string, string> = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && key !== 'page' && key !== 'limit') {
      record[key] = String(value)
    }
  })
  return record
}
