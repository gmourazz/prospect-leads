import { http } from '@/lib/http'
import type { Segment } from '@/types/domain'

export const segmentsApi = {
  list: () => http.get<{ data: Segment[] }>('/segments'),
  create: (body: { name: string; slug?: string; color?: string; icon?: string }) =>
    http.post<Segment>('/segments', body),
  update: (id: string, body: Partial<{ name: string; color: string; icon: string; is_active: boolean }>) =>
    http.patch(`/segments/${id}`, body),
}
