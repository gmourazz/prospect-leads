import { useState } from 'react'
import { ArrowRight, Copy, ExternalLink, ImageIcon, SkipForward } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  useCancelFollowup,
  useConfirmFollowup,
  usePrepareFollowup,
} from '@/features/followup/hooks/useFollowup'
import type { FollowupPreparation } from '@/features/followup/api/followup.api'
import type { Lead } from '@/types/domain'

/**
 * Picks the template ONCE for the whole batch, then steps through each
 * selected lead one at a time. WhatsApp itself has no bulk-send mechanism —
 * every chat still needs its own "Abrir WhatsApp" click and its own "sim,
 * enviei" — but the template choice and the queue navigation happen once,
 * instead of reopening this flow from scratch per lead.
 */
export function BulkWhatsAppDialog({
  leads,
  open,
  onOpenChange,
}: {
  leads: Lead[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: templates } = useTemplates()
  const prepare = usePrepareFollowup()
  const confirm = useConfirmFollowup()
  const cancel = useCancelFollowup()

  const [templateId, setTemplateId] = useState('')
  const [index, setIndex] = useState(0)
  const [prep, setPrep] = useState<FollowupPreparation | null>(null)
  const [opened, setOpened] = useState(false)
  const [sentCount, setSentCount] = useState(0)

  const list = (templates?.data ?? []).filter((t) => t.channel === 'whatsapp')
  const selected = list.find((t) => t.id === templateId)
  const current = leads[index]
  const done = index >= leads.length

  function reset() {
    setTemplateId('')
    setIndex(0)
    setPrep(null)
    setOpened(false)
    setSentCount(0)
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
      { leadId: current.id, templateVersionId: selected.version_id },
      { onSuccess: setPrep },
    )
  }

  function handleOpenWhatsApp() {
    if (!prep) return
    window.open(prep.whatsapp_link, '_blank', 'noopener')
    setOpened(true)
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Chamar no WhatsApp {leads.length > 1 && `· ${Math.min(index + 1, leads.length)} de ${leads.length}`}
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
            <p className="py-6 text-center text-[13.5px]">
              Pronto — {sentCount} de {leads.length} enviada{sentCount === 1 ? '' : 's'}.
            </p>
          ) : (
            <>
              <p className="text-[13px] font-medium">{current.company.name}</p>
              {!prep ? (
                <Button onClick={handlePrepare} loading={prepare.isPending}>
                  Preparar mensagem
                </Button>
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
