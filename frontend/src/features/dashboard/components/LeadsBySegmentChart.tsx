import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import { segmentColorHex } from '@/lib/segment-colors'
import type { DashboardMetrics } from '@/types/domain'

export function LeadsBySegmentChart({
  data,
  isLoading,
}: {
  data?: DashboardMetrics['by_segment']
  isLoading?: boolean
}) {
  const max = data?.[0]?.leads || 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads por segmento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
          : data?.map((segment) => (
              <div key={segment.segment_name} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-[12px] text-muted-foreground">
                  {segment.segment_name}
                </span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                  <div
                    className="h-full rounded-md transition-all"
                    style={{
                      width: `${Math.max((segment.leads / max) * 100, 3)}%`,
                      backgroundColor: `color-mix(in srgb, ${segmentColorHex(segment.color)} 55%, white)`,
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-[12px] font-medium tabular">
                  {formatNumber(segment.leads)}
                </span>
              </div>
            ))}
      </CardContent>
    </Card>
  )
}
