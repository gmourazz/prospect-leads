import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, Bookmark, LayoutList, RefreshCw, Rows3, Search, Plus, RotateCcw, Star, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SegmentedControl } from '@/components/common/SegmentedControl'
import { QuickFilters } from './QuickFilters'
import { LeadFiltersSheet } from './LeadFiltersSheet'
import { useSavedViews } from '../hooks/useSavedViews'
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
  onRefresh,
  refreshing,
}: {
  filters: LeadFilters
  counts: LeadCounts | undefined
  onSetFilter: (key: string, value: string | undefined) => void
  onApplyFilters: (patch: Partial<LeadFilters>) => void
  activeCount: number
  onNewLead: () => void
  density: Density
  onDensityChange: (density: Density) => void
  onRefresh: () => void
  refreshing: boolean
}) {
  const { views, save, remove } = useSavedViews()
  const navigate = useNavigate()

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
          variant="secondary"
          size="sm"
          className="h-10 rounded-xl"
          disabled={activeCount === 0}
          onClick={() => {
            onApplyFilters({
              segment_id: undefined, city: undefined, state: undefined,
              status: undefined, website_status: undefined, open_now: undefined,
              has_email: undefined, contact_state: undefined, q: undefined,
            })
          }}
        >
          <RotateCcw />
          Limpar tudo
        </Button>

        {views.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="h-10 rounded-xl">
                <Bookmark />
                Visões
                <span className="tabular text-muted-foreground">{views.length}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Visões salvas</DropdownMenuLabel>
              {views.map((v) => (
                <DropdownMenuItem
                  key={v.name}
                  onSelect={() => navigate(`/leads${v.search}`)}
                  className="justify-between"
                >
                  <span className="truncate">{v.name}</span>
                  <button
                    type="button"
                    aria-label={`Remover visão ${v.name}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(v.name)
                    }}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-danger"
                  >
                    <X className="size-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          variant="outline"
          size="sm"
          className="h-10 rounded-xl border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
          onClick={() => {
            const name = window.prompt('Nome da visão salva:')
            if (name) save(name, window.location.search)
          }}
        >
          <Star />
          Salvar visão
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-10 rounded-xl"
          onClick={onRefresh}
          loading={refreshing}
        >
          <RefreshCw />
          Atualizar
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-10 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5"
          onClick={onNewLead}
        >
          <Plus />
          Novo lead
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
        <QuickFilters
          value={filters.contact_state}
          counts={counts}
          onChange={(v) => onSetFilter('contact_state', v)}
        />

        <div className="ml-auto flex items-center gap-3">
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
        </div>
      </div>

      <LeadFiltersSheet
        filters={filters}
        onApply={onApplyFilters}
      />
    </div>
  )
}
