import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'

const BAR_TONE_CLASSES = {
  neutral: 'bg-gradient-to-r from-primary/40 to-primary/60',
  success: 'bg-success/50',
  warning: 'bg-warning/50',
  danger: 'bg-danger/50',
}

const ICON_TONE_CLASSES = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  danger: 'bg-danger-subtle text-danger',
}

const BADGE_VARIANT = {
  neutral: 'neutral',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
} as const

export function MetricCard({
  label,
  value,
  icon: Icon,
  isLoading,
  format = 'number',
  tone = 'neutral',
  badgeText,
  progress,
}: {
  label: string
  value?: number
  icon: LucideIcon
  isLoading?: boolean
  format?: 'number' | 'percent'
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  badgeText?: string
  progress?: number
}) {
  return (
    <Card>
      <CardContent className="p-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className={cn('flex size-7 shrink-0 items-center justify-center rounded-[8px]', ICON_TONE_CLASSES[tone])}>
              <Icon className="size-3.5" />
            </div>
            <p className="truncate text-[12.5px] font-medium text-muted-foreground">{label}</p>
          </div>
          {badgeText && !isLoading && (
            <Badge variant={BADGE_VARIANT[tone]} className="shrink-0">
              {badgeText}
            </Badge>
          )}
        </div>
        {isLoading || value === undefined ? (
          <Skeleton className="mt-2 h-7 w-16" />
        ) : (
          <p className="mt-1 text-2xl font-semibold tabular tracking-tight">
            {format === 'percent' ? formatPercent(value) : formatNumber(value)}
          </p>
        )}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          {!isLoading && value !== undefined && (
            <div
              className={cn('h-full rounded-full transition-all', BAR_TONE_CLASSES[tone])}
              style={{ width: `${Math.min(Math.max(progress ?? 0, 2), 100)}%` }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
