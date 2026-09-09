import { http } from '@/lib/http'

export interface Settings {
  sender_email: string
  /** Appended to every outgoing message, so it lives in one place instead
   * of being repeated (and drifting) across templates. */
  email_signature: string
}

export const settingsApi = {
  get: () => http.get<Settings>('/settings'),
  update: (body: { email_signature: string }) => http.put<Settings>('/settings', body),
}
