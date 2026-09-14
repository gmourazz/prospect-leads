import { http } from '@/lib/http'

export interface Settings {
  sender_email: string
  /** Appended to every outgoing message, so it lives in one place instead
   * of being repeated (and drifting) across templates. */
  email_signature: string
  /** Manual-send rate rules — checked by the backend on every "enviar lote"
   * click; there is no background scheduler enforcing these on its own. */
  daily_send_limit: number
  send_weekdays: number[]
  send_hour_start: number
  send_hour_end: number
  sent_today: number
  /** Ritmo da fila automática do WhatsApp. Diferente das regras de email,
   *  estas são checadas a cada mensagem, não a cada clique — e afrouxá-las é
   *  o que faz um número ser restringido. */
  wa_daily_limit: number
  wa_min_interval_sec: number
  wa_max_interval_sec: number
  wa_burst_size: number
  wa_burst_pause_min: number
  wa_weekdays: number[]
  wa_hour_start: number
  wa_hour_end: number
}

export type SettingsUpdate = Partial<
  Pick<
    Settings,
    | 'email_signature'
    | 'daily_send_limit'
    | 'send_weekdays'
    | 'send_hour_start'
    | 'send_hour_end'
    | 'wa_daily_limit'
    | 'wa_min_interval_sec'
    | 'wa_max_interval_sec'
    | 'wa_burst_size'
    | 'wa_burst_pause_min'
    | 'wa_weekdays'
    | 'wa_hour_start'
    | 'wa_hour_end'
  >
>

export const settingsApi = {
  get: () => http.get<Settings>('/settings'),
  update: (body: SettingsUpdate) => http.put<Settings>('/settings', body),
}
