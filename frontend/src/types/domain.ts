export type ContactStatus = 'never_contacted' | 'contacted' | 'replied' | 'opted_out' | 'blocked'
export type WebsiteStatus = 'has_website' | 'no_website' | 'unknown' | 'review_required'
export type LeadStatus =
  | 'new' | 'qualified' | 'contacted' | 'replied' | 'interested'
  | 'negotiating' | 'customer' | 'not_interested' | 'lost' | 'archived'

export interface ContactState {
  contact_point_id: string | null
  phone_display: string
  phone_e164: string
  // null = unknown yet (scrape didn't find one), not "no email" — the
  // business may well have one.
  email: string | null
  line_type: string
  status: ContactStatus
  contact_count: number
  first_contacted_at: string | null
  last_contacted_at: string | null
  is_suppressed: boolean
  suppression_reason: string | null
  is_interested: boolean
  interest_note: string | null
  // Most recent dispatch attempt, win or lose — unlike `status`, which only
  // ever reflects a successful send (a failed attempt never touches it).
  last_channel: 'email' | 'whatsapp' | null
  has_error: boolean
  last_error_code: string | null
}

export interface WebPresence {
  id: string
  url: string
  host: string
  kind: string
}

export interface Lead {
  id: string
  status: LeadStatus
  notes: string | null
  collected_at: string
  last_interaction_at: string | null
  company: {
    id: string
    name: string
    cnpj: string | null
    city: string | null
    state: string | null
    website_status: WebsiteStatus
    opening_hours: string | null
    // null = unknown/unparseable hours — never guessed, shown as neither open nor closed
    is_open_now: boolean | null
  }
  segment: { id: string; name: string; color: string } | null
  contact: ContactState
  web_presences: WebPresence[]
  is_available: boolean
}

export interface LeadCounts {
  total: number
  available: number
  contacted: number
  replied: number
  suppressed: number
  no_phone: number
  no_website: number
  failed: number
}

export interface LeadFilters {
  segment_id?: string
  city?: string
  state?: string
  status?: string
  website_status?: string
  contact_state?: string
  q?: string
  sort?: string
  page?: number
  limit?: number
  open_now?: 'true' | 'false'
  has_email?: 'true' | 'false'
}

export interface Segment {
  id: string
  slug: string
  name: string
  color: string
  icon: string
  is_active: boolean
  sort_order: number
  lead_count: number
}

export interface TemplateImage {
  id: string
  url: string
  filename: string
}

export interface Template {
  id: string
  name: string
  description: string | null
  segment_id: string | null
  segment_name: string | null
  /** Who the pitch is written for: no_website (posso fazer um), has_website
   * (posso melhorar o seu) or any. */
  audience: 'no_website' | 'has_website' | 'any'
  /** Organizational only — there's still one automated send gateway
   * (email); a "whatsapp" template is meant to be copied or hand-sent. */
  channel: 'email' | 'whatsapp'
  /** WHEN in the relationship this fits: cold first touch, or a remarketing
   * nudge to someone already contacted before. */
  purpose: 'first_contact' | 'remarketing'
  is_active: boolean
  version_id: string | null
  version: number
  subject: string
  body: string
  variables: string[]
  images: TemplateImage[]
  updated_at: string
}

export interface CampaignProgress {
  total_targets: number
  pending: number
  sent: number
  failed: number
  excluded: number
  excluded_breakdown: Record<string, number>
}

export interface Campaign {
  id: string
  name: string
  status: string
  template_version_id: string
  template_name: string
  batch_size: number
  created_at: string
  progress: CampaignProgress
}

export interface CampaignTarget {
  id: string
  contact_point_id: string
  lead_id: string | null
  company_id: string | null
  company_name: string
  phone_display: string
  email: string | null
  city: string | null
  state: string | null
  segment_name: string | null
  state_: string
  excluded_reason: string | null
  render_vars: Record<string, string>
}

export interface Batch {
  id: string
  campaign_id: string
  sequence_no: number
  requested_size: number
  reserved_count: number
  sent_count: number
  failed_count: number
  status: string
  is_recontact: boolean
  created_at: string
  finished_at: string | null
}

export interface DispatchResult {
  dispatch_id: string
  contact_point_id: string
  company_name: string
  phone_display: string
  status: string
  sent_at: string | null
  error_code: string | null
  error_message: string | null
}

export interface BatchOutcome {
  batch: Batch
  results: DispatchResult[]
  campaign_progress: CampaignProgress
}

export interface ContactEvent {
  id: string
  type: string
  occurred_at: string
  snapshot: Record<string, string>
  note: string | null
  campaign_id: string | null
}

export interface DashboardMetrics {
  totals: {
    leads: number
    no_website: number
    available: number
    contacted: number
    replied: number
    interested: number
    negotiating: number
    customers: number
    suppressed: number
  }
  rates: { response_rate: number; interest_rate: number; conversion_rate: number }
  by_segment: {
    segment_name: string
    color: string
    leads: number
    contacted: number
    replied: number
    customers: number
  }[]
  timeline: { date: string; contacted: number; collected: number }[]
  lead_status: { status: string; count: number }[]
  recent_activity: { type: string; occurred_at: string; company_name: string; detail: string }[]
}

export interface ImportRowView {
  row_number: number
  company_name: string
  phone_display: string
  city: string
  state: string
  website: string
  outcome: string
  reason: string
  already_contacted: boolean
  errors: string[]
}

export interface ImportPreview {
  job_id: string
  filename: string
  status: string
  total_rows: number
  will_create: number
  will_merge: number
  will_skip: number
  needs_review: number
  invalid: number
  already_contacted: number
  column_mapping: Record<string, string>
  headers: string[]
  rows: ImportRowView[]
}

export interface Suppression {
  id: string
  contact_point_id: string
  phone_display: string
  company_name: string | null
  reason: string
  note: string | null
  created_at: string
}

export interface InterestMark {
  id: string
  contact_point_id: string
  phone_display: string
  company_name: string | null
  note: string | null
  created_at: string
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Novo',
  qualified: 'Qualificado',
  contacted: 'Contatado',
  replied: 'Respondeu',
  interested: 'Interessado',
  negotiating: 'Em negociação',
  customer: 'Cliente',
  not_interested: 'Sem interesse',
  lost: 'Perdido',
  archived: 'Arquivado',
}

export const WEBSITE_STATUS_LABELS: Record<WebsiteStatus, string> = {
  has_website: 'Tem site',
  no_website: 'Sem site',
  unknown: 'Desconhecido',
  review_required: 'Revisar',
}

export const EXCLUSION_LABELS: Record<string, string> = {
  already_contacted: 'já contatados',
  suppressed: 'bloqueados',
  no_email: 'sem email',
  not_mobile: 'telefone fixo',
  invalid_phone: 'sem telefone válido',
  other: 'outros',
}

export const TEMPLATE_AUDIENCE_LABELS: Record<string, string> = {
  no_website: 'Sem site',
  has_website: 'Já tem site',
  any: 'Todos',
}

export const TEMPLATE_CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
}

export const TEMPLATE_PURPOSE_LABELS: Record<string, string> = {
  first_contact: 'Primeiro contato',
  remarketing: 'Remarketing',
}
