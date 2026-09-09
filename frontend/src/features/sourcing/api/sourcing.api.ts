import { http } from '@/lib/http'

export interface SearchCandidate {
  external_id: string
  company_name: string
  /** Filled when the search covered every segment at once, so each result
   * still knows which one it answered for. */
  segment_id: string
  segment_name: string
  phone_display: string
  city: string
  state: string
  website: string
  email: string
  opening_hours: string
  already_contacted: boolean
  existing_company: boolean
  invalid: boolean
}

export interface SearchOutcome {
  provider: string
  is_demo: boolean
  results: SearchCandidate[]
}

export interface ImportSelectedResult {
  created: number
  merged: number
  already_contacted: number
  invalid: number
}

export const sourcingApi = {
  usage: () => http.get<UsageStatus>('/searches/usage'),

  search: (body: { segment_id: string; city: string; state: string; limit?: number }) =>
    http.post<SearchOutcome>('/searches', body),

  importSelected: (body: { segment_id?: string; provider: string; candidates: SearchCandidate[] }) =>
    http.post<ImportSelectedResult>('/searches/import', {
      segment_id: body.segment_id,
      provider: body.provider,
      candidates: body.candidates.map((c) => ({
        company_name: c.company_name,
        phone_display: c.phone_display,
        city: c.city,
        state: c.state,
        website: c.website,
        email: c.email,
        segment_id: c.segment_id,
        opening_hours: c.opening_hours,
      })),
    }),
}

export interface UsageStatus {
  provider: string
  year_month: string
  call_count: number
  free_quota: number
  is_billed: boolean
}
