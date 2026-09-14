import { MessageCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DashboardMetrics } from '@/types/domain'

const DOT_COLORS = ['bg-primary', 'bg-info', 'bg-danger', 'bg-success']

export function RecentActivity({
  items,
  isLoading,
}: {
  items?: DashboardMetrics['recent_activity']
  isLoading?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Atividade recente</CardTitle>
        {!isLoading && items?.[0] && (
          <span className="text-[11px] text-muted-foreground">{formatRelative(items[0].occurred_at)}</span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : !items || items.length === 0 ? (
          <EmptyState icon={MessageCircle} title="Sem atividade ainda" />
        ) : (
          <ul className="space-y-3.5">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className={cn('size-2 shrink-0 rounded-full', DOT_COLORS[i % DOT_COLORS.length])} />
                <div className="min-w-0 flex-1 truncate text-[13px]">
                  <span className="font-semibold">{item.company_name}</span>
                  {item.detail && <span className="ml-2 text-muted-foreground">{item.detail}</span>}
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {formatRelative(item.occurred_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
