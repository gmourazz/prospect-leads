import { useRef, useState } from 'react'
import { ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { useCampaign, useSendBatch } from '../hooks/useCampaigns'
import { ApiError } from '@/lib/api-error'
import { type BatchOutcome } from '@/types/domain'
import { formatNumber } from '@/lib/format'
import { toast } from 'sonner'

const DELAY_BETWEEN_BATCHES_MS = 1200

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Runs the same single-batch mutation as SendBatchButton in a client-side
 * loop, one call at a time, each with its own idempotency key. The backend
 * still only ever processes one explicit batch per request — this button
 * just automates the repeated click instead of the user doing it by hand.
 * A stop flag lets the user cancel between batches; the loop also stops on
 * its own the moment the backend refuses a batch (e.g. the send window
 * closed for the day).
 */
export function ProcessAllButton({
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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const [sentTotal, setSentTotal] = useState(0)
  const [failedTotal, setFailedTotal] = useState(0)
  const [remaining, setRemaining] = useState(pending)
  const stopRef = useRef(false)

  if (pending <= batchSize) return null

  const totalBatches = Math.ceil(pending / batchSize)

  async function runLoop() {
    setRunning(true)
    stopRef.current = false
    setDone(0)
    setSentTotal(0)
    setFailedTotal(0)
    let left = pending

    while (left > 0 && !stopRef.current) {
      const key = acquire()
      try {
        const outcome = await sendBatch.mutateAsync({
          size: Math.min(batchSize, left),
          idempotencyKey: key,
        })
        release()
        onResult?.(outcome)
        setDone((d) => d + 1)
        setSentTotal((s) => s + outcome.batch.sent_count)
        setFailedTotal((f) => f + outcome.batch.failed_count)
        left = outcome.campaign_progress.pending
        setRemaining(left)
        if (outcome.batch.reserved_count === 0) break
      } catch (error) {
        release()
        if (error instanceof ApiError && error.code === 'send_window_closed') {
          toast.info('Fora da janela de envio configurada', {
            description: 'O processamento parou aqui; o restante fica pendente.',
          })
        }
        break
      }
      if (left > 0 && !stopRef.current) await sleep(DELAY_BETWEEN_BATCHES_MS)
    }

    setRunning(false)
    if (!stopRef.current) setConfirmOpen(false)
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(true)}>
        <ListChecks />
        Processar tudo ({formatNumber(pending)})
      </Button>

      <Dialog open={confirmOpen} onOpenChange={(open) => !running && setConfirmOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Processar todos os pendentes</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-2 text-[13px]">
            <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
              <span className="text-muted-foreground">Contatos pendentes</span>
              <span className="font-semibold tabular">{formatNumber(pending)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Campanha</span>
              <span className="font-medium">{campaign?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Lotes de</span>
              <span className="font-medium">{batchSize} ({totalBatches} lotes)</span>
            </div>
            {!running && (
              <p className="text-[12px] text-muted-foreground">
                Os lotes são enviados em sequência, um de cada vez. Se o dia/horário configurado
                para envio acabar no meio do caminho, o processamento para e o restante continua
                pendente.
              </p>
            )}
            {running && (
              <div className="space-y-1.5 border-t border-border pt-2.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(done / totalBatches) * 100}%` }}
                  />
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Lote {done}/{totalBatches} · {sentTotal} enviadas
                  {failedTotal > 0 && `, ${failedTotal} falharam`} · {formatNumber(remaining)} restantes
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            {running ? (
              <Button variant="ghost" onClick={() => { stopRef.current = true }}>
                Parar
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={runLoop}>Confirmar e processar tudo</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
