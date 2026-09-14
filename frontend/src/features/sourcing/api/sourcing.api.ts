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
  is_mobile: boolean
  is_blocked: boolean
  invalid: boolean
}

/** The four toggles on the search form. Sent on every search, so what the
 * screen shows is always what the provider result was filtered by. */
export interface SearchFilters {
  only_without_site: boolean
  skip_existing: boolean
  require_mobile: boolean
  include_blocked: boolean
}

export interface SearchRun {
  id: string
  segment_id: string | null
  segment_label: string
  city: string
  state: string
  leads_found: number
  created_at: string
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

  search: (
    body: { segment_id: string; city: string; state: string; limit?: number } & Partial<SearchFilters>,
  ) => http.post<SearchOutcome>('/searches', body),

  recent: () => http.get<{ data: SearchRun[] }>('/searches/recent'),

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

  searchState: (body: { segment_id: string; state: string; cities: string[]; limit?: number }) =>
    http.post<{ queued: number }>('/searches/state', body),

  stateSearchProgress: () => http.get<StateSearchProgress>('/searches/state/progress'),

  cancelStateSearch: () => http.post<{ status: string }>('/searches/state/cancel', {}),
}

export interface UsageStatus {
  provider: string
  year_month: string
  call_count: number
  free_quota: number
  is_billed: boolean
}

export interface StateSearchProgress {
  running: boolean
  state: string
  total_cities: number
  processed_cities: number
  current_city: string
  leads_found: number
  cancelled: boolean
  started_at?: string
  finished_at?: string
}
