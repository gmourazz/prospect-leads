import { http } from '@/lib/http'
import type { InterestMark } from '@/types/domain'

export const interestedApi = {
  list: () => http.get<{ data: InterestMark[] }>('/interested'),
}
