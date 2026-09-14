import { http } from '@/lib/http'

/** Estado da sessão relatado pelo bridge local. */
export type WhatsAppConnection =
  | 'offline'
  | 'connecting'
  | 'qr_required'
  | 'connected'
  | 'logged_out'
  | 'blocked'

export interface WhatsAppAgentState {
  connection: WhatsAppConnection
  paused: boolean
  pause_reason: string | null
  /** Nenhuma mensagem sai antes deste instante. */
  next_allowed_at: string
  burst_count: number
  last_sent_at: string | null
  last_heartbeat_at: string | null
  last_error: string | null
}

export interface WhatsAppCounts {
  queued: number
  sending: number
  sent_today: number
  sent_total: number
  failed: number
}

export interface WhatsAppRules {
  wa_daily_limit: number
  wa_min_interval_sec: number
  wa_max_interval_sec: number
  wa_burst_size: number
  wa_burst_pause_min: number
  wa_weekdays: number[]
  wa_hour_start: number
  wa_hour_end: number
}

export interface WhatsAppQueueItem {
  dispatch_id: string
  company_name: string
  phone_display: string
  status: 'sent' | 'failed' | 'sending'
  body_preview: string | null
  error_message: string | null
  sent_at: string | null
  updated_at: string
}

export interface WhatsAppQueueStatus {
  state: WhatsAppAgentState
  counts: WhatsAppCounts
  rules: WhatsAppRules
  recent: WhatsAppQueueItem[]
}

export interface EnqueueResult {
  queued: number
  /** Motivo → quantidade, para explicar a diferença entre selecionados e enfileirados. */
  skipped: Record<string, number>
}

export const whatsappApi = {
  status: () => http.get<WhatsAppQueueStatus>('/whatsapp/queue'),

  enqueue: (leadIds: string[], templateVersionId: string) =>
    http.post<EnqueueResult>('/whatsapp/queue', {
      lead_ids: leadIds,
      template_version_id: templateVersionId,
    }),

  pause: () => http.post<WhatsAppQueueStatus>('/whatsapp/queue/pause'),
  resume: () => http.post<WhatsAppQueueStatus>('/whatsapp/queue/resume'),
  clear: () => http.del<{ canceled: number }>('/whatsapp/queue'),
}

export const SKIP_REASONS: Record<string, string> = {
  sem_telefone: 'sem telefone',
  nao_contatar: 'na lista de não contatar',
  telefone_fixo: 'telefone fixo',
  ja_contatado: 'já receberam WhatsApp',
}
