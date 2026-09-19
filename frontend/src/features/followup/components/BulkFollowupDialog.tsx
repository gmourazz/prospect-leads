import { useEffect, useState } from 'react'
import { ArrowRight, Clock, Copy, ExternalLink, ImageIcon, SkipForward } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-error'
import { useWhatsAppPacing } from '@/features/leads/hooks/useWhatsAppPacing'
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
import { useCancelFollowup, useConfirmFollowup, usePrepareFollowup } from '../hooks/useFollowup'
import type { AwaitingReply, FollowupPreparation } from '../api/followup.api'

/**
 * O irmão em massa do FollowupDialog: mesmo mecanismo (template escolhido uma
 * vez, mensagem preparada e confirmada uma a uma — WhatsApp não manda em
 * lote de verdade), só que passeando pela fila de leads aguardando resposta
 * em vez de um só. Espelha o BulkWhatsAppDialog de Leads, adaptado pro
 * formato de AwaitingReply em vez de Lead.
 */
export function BulkFollowupDialog({
  leads,
  open,
  onOpenChange,
}: {
  leads: AwaitingReply[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: templates } = useTemplates()
  const prepare = usePrepareFollowup()
  const confirm = useConfirmFollowup()
  const cancel = useCancelFollowup()
  const pacing = useWhatsAppPacing()

  const [templateId, setTemplateId] = useState('')
  const [index, setIndex] = useState(0)
  const [prep, setPrep] = useState<FollowupPreparation | null>(null)
  const [opened, setOpened] = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const [autoSkipped, setAutoSkipped] = useState(0)
  const [attemptedIndex, setAttemptedIndex] = useState(-1)

  const list = (templates?.data ?? []).filter((t) => t.channel === 'whatsapp')
  const selected = list.find((t) => t.id === templateId)
  const current = leads[index]
  const done = index >= leads.length
  const inProgress = Boolean(selected) && !done

  function reset() {
    setTemplateId('')
    setIndex(0)
    setPrep(null)
    setOpened(false)
    setSentCount(0)
    setAutoSkipped(0)
    setAttemptedIndex(-1)
  }

  function close() {
    onOpenChange(false)
    reset()
  }

  function advance() {
    setPrep(null)
    setOpened(false)
    setIndex((i) => i + 1)
  }

  function handlePrepare() {
    if (!selected?.version_id || !current) return
    prepare.mutate(
      { leadId: current.lead_id, templateVersionId: selected.version_id },
      {
        onSuccess: setPrep,
        onError: (error) => {
          const code = error instanceof ApiError ? error.code : ''
          if (code === 'already_contacted' || code === 'contact_suppressed') {
            setAutoSkipped((n) => n + 1)
            advance()
          }
        },
      },
    )
  }

  useEffect(() => {
    if (!selected?.version_id || !current || prep || pacing.blocked) return
    if (attemptedIndex === index) return
    setAttemptedIndex(index)
    handlePrepare()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, current, prep, pacing.blocked, index, attemptedIndex])

  function handleOpenWhatsApp() {
    if (!prep) return
    window.open(prep.whatsapp_link, '_blank', 'noopener')
    setOpened(true)
    pacing.registerOpen()
  }

  function handleConfirm() {
    if (!prep || !selected?.version_id) return
    confirm.mutate(
      {
        dispatchId: prep.dispatch_id,
        template_version_id: selected.version_id,
        rendered_body: prep.rendered_body,
        company_name: prep.company_name,
        template_name: selected.name,
      },
      {
        onSuccess: () => {
          setSentCount((n) => n + 1)
          advance()
        },
      },
    )
  }

  function handleSkip() {
    if (prep) cancel.mutate(prep.dispatch_id)
    advance()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent
        className="max-w-lg"
        onInteractOutside={(e) => inProgress && e.preventDefault()}
        onEscapeKeyDown={(e) => inProgress && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            Follow-up no WhatsApp {leads.length > 1 && `· ${Math.min(index + 1, leads.length)} de ${leads.length}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          {!selected ? (
            <>
              <p className="text-[12.5px] text-muted-foreground">
                Escolhe o template uma vez — ele é usado pra {leads.length} contato
                {leads.length === 1 ? '' : 's'} selecionado{leads.length === 1 ? '' : 's'}, um de cada vez.
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
            </>
          ) : done ? (
            <div className="space-y-1.5 py-6 text-center">
              <p className="text-[13.5px]">
                Pronto — {sentCount} de {leads.length} enviada{sentCount === 1 ? '' : 's'}.
              </p>
              {autoSkipped > 0 && (
                <p className="text-[12px] text-muted-foreground">
                  {autoSkipped} pulado(s) automaticamente: já tinham recebido WhatsApp ou
                  estão na lista de não contatar.
                </p>
              )}
            </div>
          ) : pacing.blocked && !prep ? (
            <div className="space-y-2 rounded-md border border-warning-subtle bg-warning-subtle p-4 text-center">
              <p className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-warning">
                <Clock className="size-4" /> Pausa de segurança
              </p>
              <p className="text-[12.5px] text-muted-foreground">
                {pacing.batchSize} conversas abertas seguidas — pausando por{' '}
                {formatRemaining(pacing.remainingMs)} pra não arriscar o WhatsApp restringir o
                número por atividade em massa.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13px] font-medium">{current.company_name}</p>
              <p className="text-[12px] text-muted-foreground">
                Email enviado há {current.days_since_email} dia(s) e sem resposta.
              </p>
              {!prep ? (
                prepare.isError ? (
                  <div className="space-y-2">
                    <p className="text-[12.5px] text-danger">
                      Não deu para preparar a mensagem agora.
                    </p>
                    <Button variant="outline" onClick={handlePrepare}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <p className="text-[12.5px] text-muted-foreground">Preparando mensagem…</p>
                )
              ) : (
                <>
                  <div className="rounded-md border border-border bg-surface p-3">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
                      {prep.rendered_body}
                    </p>
                  </div>
                  {prep.images.length > 0 && (
                    <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <ImageIcon className="size-3.5" />
                      {prep.images.length} imagem(ns) do template: anexe manualmente no WhatsApp
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleOpenWhatsApp}>
                      <ExternalLink /> Abrir WhatsApp
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(prep.rendered_body)
                        toast.success('Mensagem copiada')
                      }}
                    >
                      <Copy /> Copiar texto
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            {done ? 'Fechar' : 'Cancelar tudo'}
          </Button>
          {selected && !done && (
            <Button variant="outline" onClick={handleSkip} disabled={confirm.isPending}>
              <SkipForward /> Pular
            </Button>
          )}
          {selected && prep && !done && (
            <Button onClick={handleConfirm} disabled={!opened} loading={confirm.isPending}>
              {index + 1 < leads.length ? (
                <>Enviei, próximo <ArrowRight /></>
              ) : (
                'Enviei'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
