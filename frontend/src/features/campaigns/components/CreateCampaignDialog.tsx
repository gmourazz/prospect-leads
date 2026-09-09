import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTemplates } from '@/features/templates/hooks/useTemplates'
import type { Template } from '@/types/domain'
import type { LeadFilters } from '@/types/domain'
import { useCreateCampaign } from '../hooks/useCampaigns'
import { filtersToQueryRecord } from '../api/campaigns.api'

/**
 * A campaign always snapshots the filter, never a set of row checkboxes: the
 * backend resolves "every available contact matching this filter" at
 * creation time, so the eligible-count math the board already shows stays the
 * single source of truth for what gets included.
 */
export function CreateCampaignDialog({
  open,
  onOpenChange,
  filters,
  matchingCount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: LeadFilters
  matchingCount?: number
}) {
  const navigate = useNavigate()
  const { data: templates } = useTemplates()
  const createCampaign = useCreateCampaign()

  const [name, setName] = useState('')
  const [templateVersionId, setTemplateVersionId] = useState('')
  const [batchSize, setBatchSize] = useState(10)

  function handleCreate() {
    if (!name || !templateVersionId) return
    createCampaign.mutate(
      {
        name,
        template_version_id: templateVersionId,
        batch_size: batchSize,
        filters: filtersToQueryRecord(filters),
      },
      {
        onSuccess: (campaign) => {
          onOpenChange(false)
          navigate(`/campanhas/${campaign.id}`)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova campanha</DialogTitle>
          <DialogDescription>
            {matchingCount !== undefined
              ? `Incluirá todos os leads disponíveis que correspondem ao filtro atual (${matchingCount} encontrados).`
              : 'Incluirá todos os leads disponíveis que correspondem ao filtro atual.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-2">
          <div className="space-y-1.5">
            <Label>Nome da campanha</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Barbearias UDI - Setembro"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={templateVersionId} onValueChange={setTemplateVersionId}>
              <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
              <SelectContent>
                {templates?.data.map((t: Template) => (
                  <SelectItem key={t.id} value={t.version_id ?? ''}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tamanho do lote</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
            />
            <p className="text-[12px] text-muted-foreground">
              Máximo de contatos processados por clique em "Enviar próximos".
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleCreate}
            loading={createCampaign.isPending}
            disabled={!name || !templateVersionId}
          >
            Criar campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
