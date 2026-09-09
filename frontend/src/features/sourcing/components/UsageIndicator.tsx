import { AlertTriangle } from 'lucide-react'
import { useSearchUsage } from '../hooks/useSourcing'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Google Places bills per call above the free monthly quota; OpenStreetMap
 * doesn't. This just shows where things stand — it never blocks a search,
 * since going over is the user's call to make, not something to fake-enforce.
 */
export function UsageIndicator() {
  const { data } = useSearchUsage()
  if (!data) return null

  if (!data.is_billed) {
    return (
      <p className="text-[12px] text-muted-foreground">
        {formatNumber(data.call_count)} buscas este mês · OpenStreetMap (grátis, sem limite)
      </p>
    )
  }

  const percent = Math.min((data.call_count / data.free_quota) * 100, 100)
  const tone = percent >= 100 ? 'danger' : percent >= 80 ? 'warning' : 'success'
  const barColor = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }[tone]
  const textColor = { success: 'text-muted-foreground', warning: 'text-warning', danger: 'text-danger' }[tone]

  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${percent}%` }} />
      </div>
      <p className={cn('text-[12px] tabular', textColor)}>
        {tone !== 'success' && <AlertTriangle className="mr-1 inline size-3 -translate-y-px" />}
        {formatNumber(data.call_count)} / {formatNumber(data.free_quota)} buscas grátis este mês
        {percent >= 100 && ' — próximas buscas serão cobradas'}
      </p>
    </div>
  )
}
