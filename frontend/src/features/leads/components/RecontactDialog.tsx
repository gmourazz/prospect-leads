import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { formatDateTime, pluralize } from '@/lib/format'
import { ApiError } from '@/lib/api-error'
import { leadsApi } from '../api/leads.api'
import { useMutation } from '@tanstack/react-query'
import { useContactEvents } from '../hooks/useLeads'

/**
 * Recontact is never automatic. This dialog is the one explicit gate: it
 * creates a single-use approval that the database CHECK constraint requires
 * before any second dispatch to this contact can exist. Sending itself still
 * happens through a recontact-mode campaign batch.
 */
export function RecontactDialog({
  open,
  onOpenChange,
  contactPointId,
  lastContactedAt,
  contactCount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactPointId: string
  lastContactedAt: string | null
  contactCount: number
}) {
  const [reason, setReason] = useState('')
  const { data: history } = useContactEvents(open ? contactPointId : null)
  const lastTemplateName = history?.events.find((e) => e.type === 'message_sent')?.snapshot.template_name

  const approve = useMutation({
    mutationFn: () => leadsApi.approveRecontact(contactPointId, reason || 'recontato manual'),
    onSuccess: () => {
      toast.success('Recontato autorizado', {
        description:
          'Este contato agora pode ser incluído em um lote de recontato ao criar uma nova campanha.',
      })
      onOpenChange(false)
      setReason('')
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar novamente?</DialogTitle>
          <DialogDescription>
            Este contato já recebeu {contactCount} {pluralize(contactCount, 'mensagem', 'mensagens')}
            {lastContactedAt ? `, a última em ${formatDateTime(lastContactedAt)}` : ''}
            {lastTemplateName ? ` (template "${lastTemplateName}")` : ''}. Confirme para autorizar um
            novo envio.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-2">
          <Textarea
            placeholder="Motivo do recontato (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={approve.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => approve.mutate()} loading={approve.isPending}>
            Autorizar recontato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
