import { useState } from 'react'
import { Users, CheckCheck, Send, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDashboard } from '@/features/dashboard/hooks/useDashboard'
import { MetricCard } from '@/features/dashboard/components/MetricCard'
import { LeadsBySegmentChart } from '@/features/dashboard/components/LeadsBySegmentChart'
import { FunnelChart } from '@/features/dashboard/components/FunnelChart'
import { RecentActivity } from '@/features/dashboard/components/RecentActivity'

const PERIODS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
]

export function DashboardPage() {
  const [days, setDays] = useState(30)
  const { data, isLoading, isError, error, refetch } = useDashboard(days)

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  const t = data?.totals
  const pct = (value?: number) => (t?.leads ? ((value ?? 0) / t.leads) * 100 : 0)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral da prospecção"
        actions={
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <TabsList>
              {PERIODS.map((p) => (
                <TabsTrigger key={p.days} value={String(p.days)}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <MetricCard label="Total de leads" value={t?.leads} icon={Users} isLoading={isLoading} progress={100} />
        <MetricCard
          label="Já contatados"
          value={t?.contacted}
          icon={CheckCheck}
          isLoading={isLoading}
          badgeText={t ? `${Math.round(pct(t.contacted))}%` : undefined}
          progress={pct(t?.contacted)}
        />
        <MetricCard
          label="Disponíveis agora"
          value={t?.available}
          icon={Send}
          isLoading={isLoading}
          tone="success"
          progress={pct(t?.available)}
        />
        <MetricCard
          label="Taxa de resposta"
          value={data?.rates.response_rate}
          format="percent"
          icon={TrendingUp}
          isLoading={isLoading}
          tone={t?.replied ? 'success' : 'warning'}
          badgeText={t?.replied ? undefined : 'aguardando'}
          progress={(data?.rates.response_rate ?? 0) * 100}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FunnelChart totals={data?.totals} isLoading={isLoading} />
        <LeadsBySegmentChart data={data?.by_segment} isLoading={isLoading} />
      </div>

      <div className="mt-4">
        <RecentActivity items={data?.recent_activity} isLoading={isLoading} />
      </div>
    </div>
  )
}
