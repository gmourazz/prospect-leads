import { useNavigate } from 'react-router-dom'
import {
  type LucideIcon,
  Bookmark,
  CalendarClock,
  Check,
  Globe,
  GlobeLock,
  Mail,
  MailX,
  MapPin,
  RotateCcw,
  Star,
  Tag,
  Tags,
  Timer,
  X,
} from 'lucide-react'
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
import { useSegments } from '@/features/segments/hooks/useSegments'
import { useStates } from '@/features/sourcing/hooks/useCities'
import { useCities } from '../hooks/useLeads'
import { useSavedViews } from '../hooks/useSavedViews'
import { formatNumber } from '@/lib/format'
import { segmentColorHex } from '@/lib/segment-colors'
import { cn } from '@/lib/cn'
import type { LeadFilters } from '@/types/domain'

const NONE = '__all__'

const SITE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'has_website', label: 'Tem site', icon: Globe },
  { value: 'no_website', label: 'Sem site', icon: GlobeLock },
] as const

const EMAIL_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'true', label: 'Com email', icon: Mail },
  { value: 'false', label: 'Sem email', icon: MailX },
] as const

// "Em espera" approximates a contact that was messaged but hasn't cleared
// the recontact cooldown yet — the backend only tracks discrete states
// (never/contacted/replied/suppressed/available), so "contacted" is the
// closest existing bucket for "waiting."
const WINDOW_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'available', label: 'Disponível', icon: Check },
  { value: 'contacted', label: 'Em espera', icon: Timer },
] as const

export function LeadFiltersSheet({
  open,
  filters,
  onApply,
  activeCount,
}: {
  open: boolean
  filters: LeadFilters
  onApply: (patch: Partial<LeadFilters>) => void
  activeCount: number
}) {
  const { data: segments } = useSegments()
  const { data: cities } = useCities()
  const { data: states } = useStates()
  const { views, save, remove } = useSavedViews()
  const navigate = useNavigate()

  if (!open) return null

  const activeSegments = segments?.data.filter((s) => s.is_active) ?? []

  function toggleSegment(id: string) {
    onApply({ segment_id: filters.segment_id === id ? undefined : id })
  }

  return (
    <div className="border-t border-border px-6 py-5">
      {activeSegments.length > 0 && (
        <div className="mb-5">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
            <Tags className="size-3" />
            Segmento
          </p>
          <div className="flex flex-wrap gap-2">
            {activeSegments.map((s) => {
              const active = filters.segment_id === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSegment(s.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors',
                    active
                      ? 'border-primary/40 bg-primary/[0.1] text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Tag className="size-3.5" style={{ color: segmentColorHex(s.color) }} />
                  <span
                    className="size-[7px] rounded-[2px]"
                    style={{ backgroundColor: segmentColorHex(s.color) }}
                  />
                  {s.name}
                  <span className="tabular text-muted-foreground">{formatNumber(s.lead_count)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-[0.55fr_1fr_1fr_1fr_1.5fr]">
        <Field label="UF" icon={MapPin}>
          <Select
            value={filters.state ?? NONE}
            onValueChange={(v) => onApply({ state: v === NONE ? undefined : v })}
          >
            <SelectTrigger className="h-10 rounded-xl border-transparent bg-muted">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={NONE}>Todas</SelectItem>
              {states?.map((uf) => (
                <SelectItem key={uf.sigla} value={uf.sigla}>{uf.sigla}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Cidade" icon={MapPin}>
          <Select
            value={filters.city ?? NONE}
            onValueChange={(v) => onApply({ city: v === NONE ? undefined : v })}
          >
            <SelectTrigger className="h-10 rounded-xl border-transparent bg-muted">
              <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Todas</SelectItem>
              {cities?.data.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Site" icon={Globe}>
          <SegmentedControl
            options={SITE_OPTIONS}
            value={filters.website_status ?? 'all'}
            onChange={(v) => onApply({ website_status: v === 'all' ? undefined : v })}
          />
        </Field>

        <Field label="Email" icon={Mail}>
          <SegmentedControl
            options={EMAIL_OPTIONS}
            value={filters.has_email ?? 'all'}
            onChange={(v) => onApply({ has_email: v === 'all' ? undefined : (v as 'true' | 'false') })}
          />
        </Field>

        <Field label="Janela de contato" icon={CalendarClock}>
          <Select
            value={filters.contact_state ?? 'all'}
            onValueChange={(v) => onApply({ contact_state: v === 'all' ? undefined : v })}
          >
            <SelectTrigger className="h-10 rounded-xl border-transparent bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-[12.5px] text-muted-foreground">
          Combine filtros e salve como visão para reusar na próxima campanha.
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={activeCount === 0}
            onClick={() => {
              onApply({
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
                <Button variant="outline" size="sm">
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
            className="border-primary/40 text-primary hover:bg-primary/5"
            onClick={() => {
              const name = window.prompt('Nome da visão salva:')
              if (name) save(name, window.location.search)
            }}
          >
            <Star />
            Salvar visão
          </Button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </p>
      {children}
    </div>
  )
}
