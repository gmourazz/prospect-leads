import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
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
        { label: 'Leads', value: totals.leads },
        { label: 'Disponíveis', value: totals.available },
        { label: 'Contatados', value: totals.contacted },
        { label: 'Responderam', value: totals.replied },
        { label: 'Interessados', value: totals.interested },
        { label: 'Clientes', value: totals.customers },
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
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
          : stages.map((stage) => (
              <div key={stage.label} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[12px] text-muted-foreground">{stage.label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                  <div
                    className="h-full rounded-md bg-primary/80 transition-all"
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
