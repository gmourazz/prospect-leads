import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useCampaigns, useDeleteCampaign } from '@/features/campaigns/hooks/useCampaigns'
import { formatDate, formatNumber } from '@/lib/format'

const STATUS_LABEL: Record<string, string> = {
  active: 'Ativa', draft: 'Rascunho', completed: 'Concluída', paused: 'Pausada',
}

export function CampaignsPage() {
  const { data, isLoading, isError, error, refetch } = useCampaigns()
  const deleteCampaign = useDeleteCampaign()
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null)
  const campaigns = data?.data ?? []

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="Crie uma campanha a partir dos filtros na tela de Leads"
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Send}
          title="Nenhuma campanha ainda"
          description="Vá para Leads, filtre os contatos desejados e clique em Criar campanha."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <Card key={c.id} className="group relative transition-shadow hover:shadow-raised">
              <Link to={`/campanhas/${c.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{c.name}</p>
                    <Badge variant={c.status === 'active' ? 'success' : 'neutral'}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {c.template_name} · criada em {formatDate(c.created_at)}
                  </p>
                  <div className="mt-3 flex items-center gap-4 text-[12px]">
                    <Stat label="enviados" value={c.progress.sent} tone="success" />
                    <Stat label="pendentes" value={c.progress.pending} />
                    <Stat label="excluídos" value={c.progress.excluded} tone="muted" />
                  </div>
                </CardContent>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover campanha ${c.name}`}
                className="absolute bottom-3 right-3 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => setToDelete({ id: c.id, name: c.name })}
              >
                <Trash2 />
              </Button>
            </Card>
          ))}
        </div>
      )}

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

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'muted' }) {
  return (
    <span className={tone === 'success' ? 'text-success' : tone === 'muted' ? 'text-muted-foreground' : ''}>
      <span className="font-semibold tabular">{formatNumber(value)}</span> {label}
    </span>
  )
}
