import { Users, GlobeLock, Send, CheckCheck, MessageCircleReply, Handshake, TrendingUp, ShieldBan } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { useDashboard } from '@/features/dashboard/hooks/useDashboard'
import { MetricCard } from '@/features/dashboard/components/MetricCard'
import { LeadsBySegmentChart } from '@/features/dashboard/components/LeadsBySegmentChart'
import { ContactsOverTimeChart } from '@/features/dashboard/components/ContactsOverTimeChart'
import { FunnelChart } from '@/features/dashboard/components/FunnelChart'
import { RecentActivity } from '@/features/dashboard/components/RecentActivity'

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useDashboard(30)

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  const t = data?.totals

  return (
    <div>
      <PageHeader title="Dashboard" description="Visão geral da prospecção nos últimos 30 dias" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
        <MetricCard label="Total de leads" value={t?.leads} icon={Users} isLoading={isLoading} />
        <MetricCard label="Sem site" value={t?.no_website} icon={GlobeLock} isLoading={isLoading} tone="warning" />
        <MetricCard label="Disponíveis" value={t?.available} icon={Send} isLoading={isLoading} tone="success" />
        <MetricCard label="Já contatados" value={t?.contacted} icon={CheckCheck} isLoading={isLoading} />
        <MetricCard label="Responderam" value={t?.replied} icon={MessageCircleReply} isLoading={isLoading} tone="warning" />
        <MetricCard label="Clientes" value={t?.customers} icon={Handshake} isLoading={isLoading} tone="success" />
        <MetricCard
          label="Taxa de resposta"
          value={data?.rates.response_rate}
          format="percent"
          icon={TrendingUp}
          isLoading={isLoading}
        />
        <MetricCard label="Bloqueados" value={t?.suppressed} icon={ShieldBan} isLoading={isLoading} tone="danger" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ContactsOverTimeChart data={data?.timeline} isLoading={isLoading} />
        <LeadsBySegmentChart data={data?.by_segment} isLoading={isLoading} />
        <FunnelChart totals={data?.totals} isLoading={isLoading} />
        <RecentActivity items={data?.recent_activity} isLoading={isLoading} />
      </div>
    </div>
  )
}
