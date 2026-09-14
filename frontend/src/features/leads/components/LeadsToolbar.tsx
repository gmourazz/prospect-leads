import { ArrowUpDown, LayoutList, Rows3, Search, Plus, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SegmentedControl } from '@/components/common/SegmentedControl'
import { QuickFilters } from './QuickFilters'
import { LeadFiltersSheet } from './LeadFiltersSheet'
import { cn } from '@/lib/cn'
import type { LeadCounts, LeadFilters } from '@/types/domain'
import type { Density } from '../hooks/useLeadDensity'

const SORT_OPTIONS = [
  { value: '__default__', label: 'Mais recentes' },
  { value: 'company_name', label: 'Nome (A-Z)' },
  { value: 'last_contacted', label: 'Último contato' },
  { value: 'status', label: 'Status' },
]

const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'Confortável', icon: Rows3 },
  { value: 'compact', label: 'Compacta', icon: LayoutList },
] as const

export function LeadsToolbar({
  filters,
  counts,
  onSetFilter,
  onApplyFilters,
  activeCount,
  onNewLead,
  density,
  onDensityChange,
  filtersOpen,
  onFiltersOpenChange,
}: {
  filters: LeadFilters
  counts: LeadCounts | undefined
  onSetFilter: (key: string, value: string | undefined) => void
  onApplyFilters: (patch: Partial<LeadFilters>) => void
  activeCount: number
  onNewLead: () => void
  density: Density
  onDensityChange: (density: Density) => void
  filtersOpen: boolean
  onFiltersOpenChange: (open: boolean) => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3.5 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Empresa, telefone ou email…"
            defaultValue={filters.q ?? ''}
            className="h-10 rounded-full border-transparent bg-muted pl-9 shadow-none"
            onChange={(e) => onSetFilter('q', e.target.value || undefined)}
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className={cn('h-10 rounded-xl border-transparent', filtersOpen ? 'bg-primary/[0.1] text-primary' : 'bg-muted')}
          onClick={() => onFiltersOpenChange(!filtersOpen)}
        >
          <SlidersHorizontal />
          Filtros
          {activeCount > 0 && (
            <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>

        <Select
          value={filters.sort ?? '__default__'}
          onValueChange={(v) => onSetFilter('sort', v === '__default__' ? undefined : v)}
        >
          <SelectTrigger className="h-10 w-[168px] rounded-xl border-transparent bg-muted">
            <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SegmentedControl options={DENSITY_OPTIONS} value={density} onChange={onDensityChange} />

        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-10 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5"
          onClick={onNewLead}
        >
          <Plus />
          Novo lead
        </Button>
      </div>

      <div className="px-4 pb-4">
        <QuickFilters
          value={filters.contact_state}
          counts={counts}
          onChange={(v) => onSetFilter('contact_state', v)}
        />
      </div>

      <LeadFiltersSheet
        open={filtersOpen}
        filters={filters}
        onApply={onApplyFilters}
        activeCount={activeCount}
      />
    </div>
  )
}
