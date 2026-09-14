import { http } from '@/lib/http'
import type { Template, TemplateImage } from '@/types/domain'

export interface TemplateInput {
  name: string
  description?: string
  segment_id?: string
  audience?: string
  channel?: string
  purpose?: string
  subject: string
  body: string
  attachment_ids?: string[]
}

export const templatesApi = {
  list: (): Promise<{ data: Template[] }> => http.get('/templates'),
  get: (id: string): Promise<Template> => http.get(`/templates/${id}`),
  variables: (): Promise<{ data: string[] }> => http.get('/templates/variables'),
  create: (body: TemplateInput): Promise<Template> => http.post('/templates', body),
  newVersion: (id: string, body: TemplateInput): Promise<Template> =>
    http.post(`/templates/${id}/versions`, body),
  remove: (id: string) => http.del(`/templates/${id}`),

  /** Up to 5 images per template — enforced by the backend, not just the UI. */
  uploadAttachment: (file: File): Promise<TemplateImage> => {
    const form = new FormData()
    form.append('file', file)
    return http.post('/templates/attachments', form)
  },
}
