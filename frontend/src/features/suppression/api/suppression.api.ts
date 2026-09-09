import { http } from '@/lib/http'
import type { Suppression } from '@/types/domain'

export const suppressionApi = {
  list: () => http.get<{ data: Suppression[] }>('/suppressions'),
}
