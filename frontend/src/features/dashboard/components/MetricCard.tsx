import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'

export function MetricCard({
  label,
  value,
  icon: Icon,
  isLoading,
  format = 'number',
  tone = 'neutral',
}: {
  label: string
  value?: number
  icon: LucideIcon
  isLoading?: boolean
  format?: 'number' | 'percent'
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  const toneClasses = {
    neutral: 'bg-muted text-muted-foreground',
    success: 'bg-success-subtle text-success',
    warning: 'bg-warning-subtle text-warning',
    danger: 'bg-danger-subtle text-danger',
  }[tone]

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
          {isLoading || value === undefined ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tabular tracking-tight">
              {format === 'percent' ? formatPercent(value) : formatNumber(value)}
            </p>
          )}
        </div>
        <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', toneClasses)}>
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}
