import { useState } from 'react'
import { AlertTriangle, Zap } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTemplates } from '@/features/templates/hooks/useTemplates'
import { useEnqueueWhatsApp, useWhatsAppQueue } from '../hooks/useWhatsAppQueue'
import type { Lead } from '@/types/domain'

/**
 * Enfileira os leads selecionados para envio automático. Diferente do
 * BulkWhatsAppDialog (que abre uma conversa por vez), aqui ninguém fica
 * olhando: o bridge local envia sozinho, no ritmo que o backend permitir.
 *
 * Por isso a tela mostra quanto tempo a fila deve levar antes de confirmar —
 * "20 leads" soa instantâneo e na prática são horas.
 */
export function EnqueueWhatsAppDialog({
  leads,
  open,
  onOpenChange,
}: {
  leads: Lead[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: templates } = useTemplates()
  const { data: queue } = useWhatsAppQueue()
  const enqueue = useEnqueueWhatsApp()
  const [templateId, setTemplateId] = useState('')

  const list = (templates?.data ?? []).filter((t) => t.channel === 'whatsapp')
  const selected = list.find((t) => t.id === templateId)
  const rules = queue?.rules

  const estimate = estimateDuration(leads.length, rules)
  const overDailyLimit = rules ? leads.length > rules.wa_daily_limit : false

  function handleConfirm() {
    if (!selected?.version_id) return
    enqueue.mutate(
      { leadIds: leads.map((l) => l.id), templateVersionId: selected.version_id },
      {
        onSuccess: () => {
          setTemplateId('')
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar automático · {leads.length} lead(s)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <p className="text-[12.5px] text-muted-foreground">
            As mensagens entram numa fila e saem sozinhas pelo bridge do WhatsApp rodando na sua
            máquina. Você não precisa ficar na tela — mas o bridge precisa estar aberto.
          </p>

          {list.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-3 text-[12.5px] text-muted-foreground">
              Nenhum template marcado como canal WhatsApp ainda. Crie um em Templates.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder="Escolha o template" /></SelectTrigger>
                <SelectContent>
                  {list.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {rules && (
            <div className="space-y-1.5 rounded-md border border-border bg-surface p-3 text-[12.5px]">
              <p className="flex items-center gap-1.5 font-medium">
                <Zap className="size-3.5 text-primary" />
                Ritmo configurado
              </p>
              <p className="text-muted-foreground">
                Uma mensagem a cada {rules.wa_min_interval_sec}–{rules.wa_max_interval_sec}s, pausa de{' '}
                {rules.wa_burst_pause_min} min a cada {rules.wa_burst_size}, no máximo{' '}
                {rules.wa_daily_limit} por dia, das {rules.wa_hour_start}h às {rules.wa_hour_end}h.
              </p>
              <p className="text-muted-foreground">
                Nesse ritmo, {leads.length} mensagem(ns) leva(m) cerca de <strong>{estimate}</strong>.
              </p>
            </div>
          )}

          {overDailyLimit && (
            <p className="flex items-start gap-1.5 rounded-md bg-warning-subtle px-3 py-2 text-[12px] text-warning">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>
                A seleção passa do teto diário ({rules?.wa_daily_limit}). O resto fica na fila e sai
                nos próximos dias — nada é descartado.
              </span>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selected?.version_id}
            loading={enqueue.isPending}
          >
            Colocar na fila
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Tempo aproximado de envio, contando o intervalo médio e as pausas longas. */
function estimateDuration(count: number, rules?: { wa_min_interval_sec: number; wa_max_interval_sec: number; wa_burst_size: number; wa_burst_pause_min: number }) {
  if (!rules || count === 0) return '—'
  const averageInterval = (rules.wa_min_interval_sec + rules.wa_max_interval_sec) / 2
  const pauses = Math.floor(count / rules.wa_burst_size) * rules.wa_burst_pause_min * 60
  const totalMinutes = Math.round((count * averageInterval + pauses) / 60)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, '0')}`
}
