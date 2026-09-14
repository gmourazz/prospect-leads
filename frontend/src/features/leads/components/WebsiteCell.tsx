import { cn } from '@/lib/cn'
import { WEBSITE_STATUS_LABELS, type WebsiteStatus } from '@/types/domain'
import { WEBSITE_STATUS_TONE } from '../model/lead-status'

const DOT_TONE: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-muted-foreground/50',
}

const TEXT_TONE: Record<string, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-muted-foreground',
}

export function WebsiteCell({ status }: { status: WebsiteStatus }) {
  const tone = WEBSITE_STATUS_TONE[status]

  return (
    <span className={cn('flex items-center gap-1.5 text-[13px] font-medium', TEXT_TONE[tone])}>
      <span className={cn('size-1.5 rounded-full', DOT_TONE[tone])} />
      {WEBSITE_STATUS_LABELS[status]}
    </span>
  )
}
