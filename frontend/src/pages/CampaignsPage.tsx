import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ListChecks,
  Loader2,
  Mail,
  MessageSquareReply,
  Pause,
  Play,
  Plus,
  Send,
  ShieldOff,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useCampaigns, useDeleteCampaign, useSetCampaignStatus } from '@/features/campaigns/hooks/useCampaigns'
import { useDashboard } from '@/features/dashboard/hooks/useDashboard'
import { cn } from '@/lib/cn'
import { formatDate, formatNumber } from '@/lib/format'
import type { Campaign } from '@/types/domain'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativa', draft: 'Rascunho', completed: 'Concluída', paused: 'Pausada',
}

const TABS = [
  { key: 'all', label: 'Todas' },
  { key: 'active', label: 'Ativas' },
  { key: 'paused', label: 'Pausadas' },
  { key: 'completed', label: 'Concluídas' },
] as const

export function CampaignsPage() {
  const { data, isLoading, isError, error, refetch } = useCampaigns()
  const { data: dashboard } = useDashboard()
  const deleteCampaign = useDeleteCampaign()
  const setStatus = useSetCampaignStatus()
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('all')

  const campaigns = data?.data ?? []

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  const sent = campaigns.reduce((total, c) => total + c.progress.sent, 0)
  const excluded = campaigns.reduce((total, c) => total + c.progress.excluded, 0)
  // What can actually go out today: a campaign never sends more than its
  // batch size in one day, so pending beyond that isn't "in the queue" yet.
  const queuedToday = campaigns
    .filter((c) => c.status === 'active')
    .reduce((total, c) => total + Math.min(c.progress.pending, c.batch_size), 0)

  const counts = {
    all: campaigns.length,
    active: campaigns.filter((c) => c.status === 'active').length,
    paused: campaigns.filter((c) => c.status === 'paused').length,
    completed: campaigns.filter((c) => c.status === 'completed').length,
  }
  const visible = tab === 'all' ? campaigns : campaigns.filter((c) => c.status === tab)

  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="Cada campanha nasce de um filtro salvo na tela de Leads"
        actions={
          <Button asChild className="glow-primary">
            <Link to="/leads">
              <Plus />
              Nova campanha
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Mail} label="Emails enviados" value={sent} />
        <SummaryCard icon={Loader2} label="Na fila hoje" value={queuedToday} tone="warning" />
        <SummaryCard icon={ShieldOff} label="Excluídos por regra" value={excluded} />
        <SummaryCard icon={MessageSquareReply} label="Respostas" value={dashboard?.totals.replied ?? 0} />
      </div>

      <div className="mb-5 flex flex-wrap gap-2.5">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              'rounded-full border px-4 py-2 text-[13.5px] font-medium transition-colors',
              tab === item.key
                ? 'border-primary/50 bg-primary/[0.08] text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label} {counts[item.key]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Send}
          title={campaigns.length === 0 ? 'Nenhuma campanha ainda' : 'Nenhuma campanha neste estado'}
          description="Vá para Leads, filtre os contatos desejados e clique em Criar campanha."
        />
      ) : (
        <div className="space-y-4">
          {visible.map((campaign) => (
            <CampaignRow
              key={campaign.id}
              campaign={campaign}
              onToggleStatus={() =>
                setStatus.mutate({
                  id: campaign.id,
                  status: campaign.status === 'paused' ? 'active' : 'paused',
                })
              }
              onComplete={() => setStatus.mutate({ id: campaign.id, status: 'completed' })}
              onDelete={() => setToDelete({ id: campaign.id, name: campaign.name })}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-6 py-5">
        <p className="text-[13.5px] text-muted-foreground">
          Próxima campanha: filtre em Leads (ex.:{' '}
          <span className="font-semibold text-primary">sem site + com email + disponíveis</span>) e
          clique em Criar campanha.
        </p>
        <Button asChild variant="outline" className="border-primary/40 text-primary hover:bg-primary/5">
          <Link to="/leads">Ir para Leads</Link>
        </Button>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Remover a campanha ${toDelete?.name ?? ''}?`}
        description="O histórico do que já foi enviado é preservado: os contatos já feitos continuam marcados como contatados."
        confirmLabel="Remover"
        variant="danger"
        loading={deleteCampaign.isPending}
        onConfirm={() =>
          toDelete &&
          deleteCampaign.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })
        }
      />
    </div>
  )
}

function CampaignRow({
  campaign,
  onToggleStatus,
  onComplete,
  onDelete,
}: {
  campaign: Campaign
  onToggleStatus: () => void
  onComplete: () => void
  onDelete: () => void
}) {
  const { sent, pending, excluded } = campaign.progress
  const total = Math.max(sent + pending + excluded, 1)
  const isPaused = campaign.status === 'paused'
  const isCompleted = campaign.status === 'completed'

  return (
    <div className="group rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Link to={`/campanhas/${campaign.id}`} className="text-[17px] font-semibold hover:underline">
              {campaign.name}
            </Link>
            <Badge variant={campaign.status === 'active' ? 'success' : 'neutral'}>
              {STATUS_LABEL[campaign.status] ?? campaign.status}
            </Badge>
          </div>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Template: {campaign.template_name} · criada em {formatDate(campaign.created_at)} ·{' '}
            {campaign.batch_size} envios/dia
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/campanhas/${campaign.id}`}>
              <ListChecks /> Ver leads
            </Link>
          </Button>
          {!isCompleted && (
            <Button
              variant="outline"
              size="sm"
              className="border-warning/40 text-warning hover:bg-warning/5"
              onClick={onToggleStatus}
            >
              {isPaused ? <Play /> : <Pause />}
              {isPaused ? 'Retomar' : 'Pausar'}
            </Button>
          )}
          {!isCompleted && (
            <Button
              variant="outline"
              size="sm"
              className="border-success/40 text-success hover:bg-success/5"
              onClick={onComplete}
              title="Marcar esta campanha como concluída"
            >
              <CheckCircle2 /> Concluir
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remover campanha ${campaign.name}`}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-primary/15">
        <div className="bg-primary" style={{ width: `${(sent / total) * 100}%` }} />
        <div className="bg-warning" style={{ width: `${(pending / total) * 100}%` }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[13px]">
        <Legend className="bg-primary" label={`${formatNumber(sent)} enviados`} />
        <Legend className="bg-warning" label={`${formatNumber(pending)} pendentes`} />
        <Legend
          className="bg-primary/25"
          label={`${formatNumber(excluded)} excluídos (sem email ou bloqueados)`}
        />
      </div>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      <span className={cn('size-2.5 rounded-sm', className)} />
      {label}
    </span>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  tone?: 'warning'
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={cn('size-4', tone === 'warning' && 'text-warning')} />
        <p className="text-[13.5px]">{label}</p>
      </div>
      <p className={cn('mt-2 text-[30px] font-extrabold tabular', tone === 'warning' && 'text-warning')}>
        {formatNumber(value)}
      </p>
    </div>
  )
}
