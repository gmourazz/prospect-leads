import { http } from '@/lib/http'
import type { Suppression } from '@/types/domain'

export const suppressionApi = {
  list: () => http.get<{ data: Suppression[] }>('/suppressions'),
  block: (phone: string, reason?: string) =>
    http.post<{ status: string }>('/suppressions', { phone, reason }),
}
