import { Search, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { QuickFilters } from './QuickFilters'
import { LeadFiltersSheet } from './LeadFiltersSheet'
import type { LeadFilters } from '@/types/domain'

export function LeadsToolbar({
  filters,
  onSetFilter,
  onApplyFilters,
  activeCount,
  onNewLead,
}: {
  filters: LeadFilters
  onSetFilter: (key: string, value: string | undefined) => void
  onApplyFilters: (patch: Partial<LeadFilters>) => void
  activeCount: number
  onNewLead: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa ou telefone…"
            defaultValue={filters.q ?? ''}
            className="pl-8"
            onChange={(e) => onSetFilter('q', e.target.value || undefined)}
          />
        </div>
        <LeadFiltersSheet filters={filters} onApply={onApplyFilters} activeCount={activeCount} />
        <Button size="sm" className="ml-auto" onClick={onNewLead}>
          <Plus />
          Novo lead
        </Button>
      </div>
      <QuickFilters value={filters.contact_state} onChange={(v) => onSetFilter('contact_state', v)} />
    </div>
  )
}
