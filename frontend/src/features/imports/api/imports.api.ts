import { http } from '@/lib/http'
import type { ImportPreview } from '@/types/domain'

export const importsApi = {
  list: () => http.get<{ data: ImportPreview[] }>('/imports'),
  get: (id: string) => http.get<ImportPreview>(`/imports/${id}`),

  analyze: (file: File, segmentId?: string) => {
    const form = new FormData()
    form.append('file', file)
    if (segmentId) form.append('segment_id', segmentId)
    return http.post<ImportPreview>('/imports', form)
  },

  /** Idempotency-Key guarantees a refresh mid-commit cannot apply the import twice. */
  commit: (id: string, idempotencyKey: string) =>
    http.post<ImportPreview>(`/imports/${id}/commit`, undefined, idempotencyKey),
}
