import { useEffect, useState } from 'react'
import { Copy, ExternalLink, ImageIcon } from 'lucide-react'
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

// Reuses the exact same reservation/confirm mechanism as the email
// follow-up step (PrepareFollowup only requires a phone number, not a prior
// email) — this is just the "no email at all" entry point into the same
// WhatsApp-channel history: the app writes the text, opens the chat with it
// ready, and only "sim, enviei" records anything.
export function SendWhatsAppDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: templates } = useTemplates()
  const prepare = usePrepareFollowup()
  const confirm = useConfirmFollowup()
  const cancel = useCancelFollowup()

  const [templateId, setTemplateId] = useState('')
  const [prep, setPrep] = useState<FollowupPreparation | null>(null)
  const [opened, setOpened] = useState(false)

  const list = (templates?.data ?? []).filter((t) => t.channel === 'whatsapp')
  const selected = list.find((t) => t.id === templateId)

  useEffect(() => {
    if (!open) {
      setPrep(null)
      setOpened(false)
      setTemplateId('')
    }
  }, [open])

  function handlePrepare() {
    if (!selected?.version_id) return
    prepare.mutate(
      { leadId: lead.id, templateVersionId: selected.version_id },
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
      { onSuccess: () => onOpenChange(false) },
    )
  }

  function handleCancel() {
    if (prep) cancel.mutate(prep.dispatch_id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Chamar no WhatsApp · {lead.company.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <p className="text-[12.5px] text-muted-foreground">
            Sem email pra esse contato — o WhatsApp abre com a mensagem pronta, você anexa as
            imagens e envia. Só depois confirme aqui.
          </p>

          {list.length === 0 && !prep && (
            <p className="rounded-md border border-dashed border-border p-3 text-[12.5px] text-muted-foreground">
              Nenhum template marcado como canal WhatsApp ainda. Crie um em Templates.
            </p>
          )}

          {!prep && list.length > 0 && (
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

          {prep && (
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel}>
            {prep ? 'Não enviei' : 'Cancelar'}
          </Button>
          {!prep ? (
            <Button onClick={handlePrepare} disabled={!selected?.version_id} loading={prepare.isPending}>
              Preparar mensagem
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={!opened} loading={confirm.isPending}>
              Sim, enviei
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
