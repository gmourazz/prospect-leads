import type { LeadStatus } from '@/types/domain'

export const LEAD_STATUS_TONE: Record<LeadStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  new: 'neutral',
  qualified: 'info',
  contacted: 'info',
  replied: 'warning',
  interested: 'warning',
  negotiating: 'info',
  customer: 'success',
  not_interested: 'neutral',
  lost: 'danger',
  archived: 'neutral',
}

export const WEBSITE_STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger'> = {
  has_website: 'success',
  no_website: 'warning',
  unknown: 'neutral',
  review_required: 'danger',
}
