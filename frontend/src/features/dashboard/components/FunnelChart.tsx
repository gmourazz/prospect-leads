import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DashboardMetrics } from '@/types/domain'

export function FunnelChart({
  totals,
  isLoading,
}: {
  totals?: DashboardMetrics['totals']
  isLoading?: boolean
}) {
  const stages = totals
    ? [
        { label: 'Leads', value: totals.leads, bar: 'bg-gradient-to-r from-primary/40 to-primary/60' },
        { label: 'Contatados', value: totals.contacted, bar: 'bg-primary/50' },
        { label: 'Responderam', value: totals.replied, bar: 'bg-primary/50' },
        { label: 'Interessados', value: totals.interested, bar: 'bg-primary/50' },
        { label: 'Clientes', value: totals.customers, bar: 'bg-success/50' },
      ]
    : []
  const max = stages[0]?.value || 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de conversão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
          : stages.map((stage) => (
              <div key={stage.label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[12px] text-muted-foreground">{stage.label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                  <div
                    className={cn('h-full rounded-md transition-all', stage.bar)}
                    style={{ width: `${Math.max((stage.value / max) * 100, 3)}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-[12px] font-medium tabular">
                  {formatNumber(stage.value)}
                </span>
              </div>
            ))}
      </CardContent>
    </Card>
  )
}
