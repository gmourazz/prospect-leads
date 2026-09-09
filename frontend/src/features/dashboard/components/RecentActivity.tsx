import { MessageCircle, MessageCircleReply, ShieldOff, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { formatRelative } from '@/lib/format'
import type { DashboardMetrics } from '@/types/domain'

const ICONS: Record<string, typeof MessageCircle> = {
  message_sent: MessageCircle,
  replied: MessageCircleReply,
  opted_out: ShieldOff,
  imported_seen: Upload,
}

export function RecentActivity({
  items,
  isLoading,
}: {
  items?: DashboardMetrics['recent_activity']
  isLoading?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade recente</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : !items || items.length === 0 ? (
          <EmptyState icon={MessageCircle} title="Sem atividade ainda" />
        ) : (
          <ul className="space-y-3">
            {items.map((item, i) => {
              const Icon = ICONS[item.type] ?? MessageCircle
              return (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">
                      <span className="font-medium">{item.company_name}</span>
                      {item.detail && <span className="text-muted-foreground"> · {item.detail}</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatRelative(item.occurred_at)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
