import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime, formatNumber } from '@/lib/format'
import { EXCLUSION_LABELS, type BatchOutcome } from '@/types/domain'
import {
  useCampaign,
  useCampaignBatches,
  useCampaignTargets,
} from '@/features/campaigns/hooks/useCampaigns'
import { SendBatchButton } from '@/features/campaigns/components/SendBatchButton'
import { BatchResultSummary } from '@/features/campaigns/components/BatchResultSummary'
import { MessagePreview } from '@/features/campaigns/components/MessagePreview'
import { campaignsApi } from '@/features/campaigns/api/campaigns.api'
import { useQuery } from '@tanstack/react-query'

export function CampaignDetailPage() {
  const { id = '' } = useParams()
  const { data: campaign, isError, error, refetch } = useCampaign(id)
  const { data: batches } = useCampaignBatches(id)
  const { data: pendingTargets } = useCampaignTargets(id, 'pending')
  const [previewTargetId, setPreviewTargetId] = useState<string | undefined>()
  const [lastOutcome, setLastOutcome] = useState<BatchOutcome | null>(null)

  const { data: preview } = useQuery({
    queryKey: ['campaigns', id, 'preview', previewTargetId],
    queryFn: () => campaignsApi.preview(id, previewTargetId),
    enabled: Boolean(id) && (pendingTargets?.data.length ?? 0) > 0,
  })

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />
  if (!campaign) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const p = campaign.progress
  const excludedEntries = Object.entries(p.excluded_breakdown ?? {})
  const target = pendingTargets?.data[0]

  return (
    <div>
      <Link
        to="/campanhas"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Campanhas
      </Link>

      <PageHeader
        title={campaign.name}
        description={`Template: ${campaign.template_name} · Lote de ${campaign.batch_size}`}
        actions={
          <SendBatchButton
            campaignId={id}
            batchSize={campaign.batch_size}
            pending={p.pending}
            onResult={setLastOutcome}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Total" value={p.total_targets} />
        <MiniStat label="Pendentes" value={p.pending} />
        <MiniStat label="Enviados" value={p.sent} tone="success" />
        <MiniStat label="Falharam" value={p.failed} tone="danger" />
      </div>

      {excludedEntries.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
          <span>{p.excluded} excluídos automaticamente:</span>
          {excludedEntries.map(([reason, count]) => (
            <Badge key={reason} variant="outline">
              {formatNumber(count)} {EXCLUSION_LABELS[reason] ?? reason}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {target && preview && (
          <MessagePreview
            subject={preview.rendered_subject}
            body={preview.rendered_body}
            images={preview.images.map((img) => img.url)}
            companyName={preview.company_name}
          />
        )}
        {lastOutcome && (
          <BatchResultSummary batch={lastOutcome.batch} results={lastOutcome.results} />
        )}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Histórico de lotes</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="batches">
            <TabsList>
              <TabsTrigger value="batches">Lotes</TabsTrigger>
              <TabsTrigger value="pending">Pendentes ({p.pending})</TabsTrigger>
            </TabsList>
            <TabsContent value="batches" className="mt-3">
              {!batches || batches.data.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-muted-foreground">
                  Nenhum lote enviado ainda.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {batches.data.map((b) => (
                    <li key={b.id} className="flex items-center justify-between py-2.5 text-[13px]">
                      <span>Lote #{b.sequence_no}</span>
                      <span className="text-muted-foreground">
                        {b.sent_count} enviadas
                        {b.failed_count > 0 && `, ${b.failed_count} falharam`}
                      </span>
                      <Badge variant={b.status === 'completed' ? 'success' : 'neutral'}>
                        {b.status}
                      </Badge>
                      <span className="text-[12px] text-muted-foreground">
                        {b.finished_at ? formatDateTime(b.finished_at) : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="pending" className="mt-3">
              {!pendingTargets || pendingTargets.data.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-muted-foreground">
                  Nenhum contato pendente.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {pendingTargets.data.map((t) => (
                    <li
                      key={t.id}
                      className="flex cursor-pointer items-center justify-between py-2 text-[13px] hover:bg-muted/40"
                      onClick={() => setPreviewTargetId(t.id)}
                    >
                      <span>{t.company_name}</span>
                      <span className="text-[12px] text-muted-foreground">{t.email ?? t.phone_display}</span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'danger' }) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          className={`mt-0.5 text-lg font-semibold tabular ${
            tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : ''
          }`}
        >
          {formatNumber(value)}
        </p>
      </CardContent>
    </Card>
  )
}
