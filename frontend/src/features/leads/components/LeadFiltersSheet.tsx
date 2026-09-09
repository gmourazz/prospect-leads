import { useEffect, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useSegments } from '@/features/segments/hooks/useSegments'
import { useCities } from '../hooks/useLeads'
import { WEBSITE_STATUS_LABELS, LEAD_STATUS_LABELS } from '@/types/domain'
import type { LeadFilters } from '@/types/domain'

const NONE = '__all__'

export function LeadFiltersSheet({
  filters,
  onApply,
  activeCount,
}: {
  filters: LeadFilters
  onApply: (patch: Partial<LeadFilters>) => void
  activeCount: number
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(filters)
  const { data: segments } = useSegments()
  const { data: cities } = useCities()

  useEffect(() => {
    if (open) setDraft(filters)
  }, [open, filters])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal />
        Filtros
        {activeCount > 0 && (
          <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {activeCount}
          </span>
        )}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filtros avançados</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 px-6 pb-2">
          <div className="space-y-1.5">
            <Label>Segmento</Label>
            <Select
              value={draft.segment_id ?? NONE}
              onValueChange={(v) => setDraft((d) => ({ ...d, segment_id: v === NONE ? undefined : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todos</SelectItem>
                {segments?.data.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Select
              value={draft.city ?? NONE}
              onValueChange={(v) => setDraft((d) => ({ ...d, city: v === NONE ? undefined : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todas</SelectItem>
                {cities?.data.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Estado (UF)</Label>
            <Input
              maxLength={2}
              value={draft.state ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value.toUpperCase() }))}
              placeholder="MG"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status do lead</Label>
            <Select
              value={draft.status ?? NONE}
              onValueChange={(v) => setDraft((d) => ({ ...d, status: v === NONE ? undefined : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todos</SelectItem>
                {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Presença digital</Label>
            <Select
              value={draft.website_status ?? NONE}
              onValueChange={(v) => setDraft((d) => ({ ...d, website_status: v === NONE ? undefined : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todos</SelectItem>
                {Object.entries(WEBSITE_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Funcionamento agora</Label>
            <Select
              value={draft.open_now ?? NONE}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, open_now: v === NONE ? undefined : (v as 'true' | 'false') }))
              }
            >
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todos</SelectItem>
                <SelectItem value="true">Aberto agora</SelectItem>
                <SelectItem value="false">Fechado agora</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Só considera estabelecimentos com horário conhecido — os demais não entram em nenhum dos dois.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft({ limit: filters.limit })
              onApply({
                segment_id: undefined, city: undefined, state: undefined,
                status: undefined, website_status: undefined, open_now: undefined,
              })
              setOpen(false)
            }}
          >
            Limpar
          </Button>
          <Button onClick={() => { onApply(draft); setOpen(false) }}>Aplicar filtros</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
