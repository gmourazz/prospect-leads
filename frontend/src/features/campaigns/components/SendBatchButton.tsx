import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useCampaign, useSendBatch } from '../hooks/useCampaigns'
import { EXCLUSION_LABELS, type BatchOutcome } from '@/types/domain'
import { formatNumber } from '@/lib/format'

/**
 * The idempotency key is created on click and reused for the lifetime of this
 * one mutation attempt — so a network retry or an accidental double click
 * during "sending" can never produce a second batch. It is only released
 * after settle, ready for the NEXT explicit click.
 *
 * A confirm step sits between the click and the actual send: the user sees
 * exactly what is about to be processed — count, template, already-contacted
 * and blocked exclusions — before committing. This is about review and
 * control, not a safety mechanism against any messaging platform.
 */
export function SendBatchButton({
  campaignId,
  batchSize,
  pending,
  onResult,
}: {
  campaignId: string
  batchSize: number
  pending: number
  onResult?: (outcome: BatchOutcome) => void
}) {
  const { data: campaign } = useCampaign(campaignId)
  const { acquire, release } = useIdempotencyKey()
  const sendBatch = useSendBatch(campaignId)
  const size = Math.min(batchSize, pending)
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (pending === 0) {
    return (
      <Button variant="secondary" size="sm" disabled>
        Nenhum contato disponível
      </Button>
    )
  }

  function handleConfirm() {
    const key = acquire()
    sendBatch.mutate(
      { size, idempotencyKey: key },
      {
        onSuccess: (outcome) => onResult?.(outcome),
        onSettled: () => { release(); setConfirmOpen(false) },
      },
    )
  }

  const excluded = campaign?.progress.excluded_breakdown ?? {}
  const excludedEntries = Object.entries(excluded).filter(([, count]) => count > 0)

  return (
    <>
      <Button size="sm" onClick={() => setConfirmOpen(true)}>
        <Send />
        Processar próximos {size}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar processamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-2 text-[13px]">
            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
              <span className="text-muted-foreground">Contatos selecionados</span>
              <span className="font-semibold tabular">{formatNumber(size)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Campanha</span>
              <span className="font-medium">{campaign?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Template</span>
              <span className="font-medium">{campaign?.template_name}</span>
            </div>
            {excludedEntries.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-2.5">
                <p className="text-[12px] text-muted-foreground">Já excluídos desta campanha:</p>
                <div className="flex flex-wrap gap-1.5">
                  {excludedEntries.map(([reason, count]) => (
                    <Badge key={reason} variant="outline">
                      {formatNumber(count)} {EXCLUSION_LABELS[reason] ?? reason}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={sendBatch.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} loading={sendBatch.isPending}>
              Confirmar {size} contato{size === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
