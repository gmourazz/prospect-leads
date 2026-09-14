import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSegments } from '@/features/segments/hooks/useSegments'
import { cn } from '@/lib/cn'
import type { SearchFilters } from '../api/sourcing.api'
import { useCitiesByState, useStates } from '../hooks/useCities'

export const ALL_SEGMENTS = 'all'
export const ALL_CITIES = '__all_cities__'

const LIMITS = [10, 20, 40, 60]

const triggerClass = 'h-12 rounded-xl border-transparent bg-muted shadow-none'

const PREFS_KEY = 'prospect_search_prefs'

interface SearchPrefs {
  segmentId: string
  state: string
  city: string
  limit: number
  filters: SearchFilters
}

// Remembers the last segment/UF/cidade/filtros picked so reopening the page
// resumes where the search was left, instead of resetting to MG every time.
function loadPrefs(): Partial<SearchPrefs> {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export interface SearchParams {
  segmentId: string
  city: string
  state: string
  limit: number
  filters: SearchFilters
}

export function SearchForm({
  onSearch,
  onSearchState,
  isLoading,
  isStateSearchRunning,
  preset,
}: {
  onSearch: (params: SearchParams) => void
  onSearchState: (params: { segmentId: string; state: string; cities: string[]; limit: number }) => void
  isLoading: boolean
  isStateSearchRunning: boolean
  /** Set when "Repetir" is clicked on a recent search, so the form jumps to
   * that segment/city instead of making the user re-pick it. */
  preset?: { segmentId: string; city: string; state: string }
}) {
  const { data: segments } = useSegments()
  const [prefs] = useState(loadPrefs)
  const [segmentId, setSegmentId] = useState(prefs.segmentId ?? ALL_SEGMENTS)
  const [state, setState] = useState(prefs.state ?? 'MG')
  const [city, setCity] = useState(prefs.city ?? ALL_CITIES)
  const [limit, setLimit] = useState(prefs.limit ?? 20)
  const [filters, setFilters] = useState<SearchFilters>(
    prefs.filters ?? {
      only_without_site: true,
      skip_existing: true,
      require_mobile: false,
      include_blocked: false,
    },
  )

  const { data: states } = useStates()
  const { data: cities, isLoading: citiesLoading } = useCitiesByState(state)

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ segmentId, state, city, limit, filters }))
    } catch {
      // localStorage unavailable (private mode, quota) — preference just won't persist
    }
  }, [segmentId, state, city, limit, filters])

  // Changing state invalidates the chosen city: keeping "Uberlândia" while
  // SP is selected would silently search a city that isn't there.
  useEffect(() => {
    if (cities && cities.length > 0 && !cities.includes(city) && city !== ALL_CITIES) setCity(cities[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities])

  useEffect(() => {
    if (!preset) return
    setSegmentId(preset.segmentId)
    setState(preset.state)
    setCity(preset.city)
  }, [preset])

  const segmentCount = segments?.data.filter((s) => s.is_active).length ?? 0
  const isAllCities = city === ALL_CITIES

  function toggle(key: keyof SearchFilters) {
    setFilters((previous) => ({ ...previous, [key]: !previous[key] }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (isAllCities) {
          if (cities && cities.length > 0) onSearchState({ segmentId, state, cities, limit })
        } else if (city) {
          onSearch({ segmentId, city, state, limit, filters })
        }
      }}
    >
      <div className="grid items-end gap-4 lg:grid-cols-[1.3fr_0.7fr_1.2fr_1.2fr_auto]">
        <Field label="Segmento">
          <Select value={segmentId} onValueChange={setSegmentId}>
            <SelectTrigger className={triggerClass}>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SEGMENTS}>Todos os segmentos</SelectItem>
              {segments?.data.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="UF">
          <Select value={state} onValueChange={setState}>
            <SelectTrigger className={triggerClass}><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {states?.map((uf) => (
                <SelectItem key={uf.sigla} value={uf.sigla}>{uf.sigla}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Cidade">
          <Select value={city} onValueChange={setCity} disabled={citiesLoading}>
            <SelectTrigger className={triggerClass}>
              <SelectValue placeholder={citiesLoading ? 'Carregando…' : 'Selecione'} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {cities && cities.length > 0 && (
                <SelectItem value={ALL_CITIES}>Todas as cidades ({cities.length})</SelectItem>
              )}
              {cities?.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Resultados por segmento">
          <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
            <SelectTrigger className={triggerClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIMITS.map((n) => (
                <SelectItem key={n} value={String(n)}>até {n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Button
          type="submit"
          size="lg"
          loading={isAllCities ? false : isLoading}
          disabled={!city || isStateSearchRunning}
          className="h-12 rounded-xl px-10 glow-primary lg:w-[220px]"
        >
          <Search />
          {isAllCities ? 'Buscar no estado todo' : 'Buscar'}
        </Button>
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <div className="flex flex-wrap gap-3">
          <FilterToggle
            label="Só empresas sem site"
            active={filters.only_without_site}
            onClick={() => toggle('only_without_site')}
          />
          <FilterToggle
            label="Ignorar quem já está na base"
            active={filters.skip_existing}
            onClick={() => toggle('skip_existing')}
          />
          <FilterToggle
            label="Exigir telefone celular"
            active={filters.require_mobile}
            onClick={() => toggle('require_mobile')}
          />
          <FilterToggle
            label="Incluir bloqueados"
            active={filters.include_blocked}
            onClick={() => toggle('include_blocked')}
          />
        </div>

        {segmentId === ALL_SEGMENTS && segmentCount > 0 && (
          <p className="mt-4 text-[12.5px] text-muted-foreground">
            {isAllCities
              ? `Roda em segundo plano, cidade por cidade: até ${cities?.length ?? 0} cidades × ${segmentCount} segmentos, no ritmo do provedor.`
              : `Buscar todos os ${segmentCount} segmentos de uma vez consome ${segmentCount} consultas da cota do provedor.`}
          </p>
        )}
        {segmentId !== ALL_SEGMENTS && isAllCities && (
          <p className="mt-4 text-[12.5px] text-muted-foreground">
            Roda em segundo plano, cidade por cidade: até {cities?.length ?? 0} cidades, no ritmo do provedor.
          </p>
        )}
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

function FilterToggle({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-[13.5px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'border-primary/50 bg-primary/[0.06] text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'relative h-[18px] w-8 shrink-0 rounded-full transition-colors',
          active ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
      >
        <span
          className={cn(
            'absolute left-0 top-[3px] size-3 rounded-full bg-white transition-transform',
            active ? 'translate-x-[17px]' : 'translate-x-[3px]',
          )}
        />
      </span>
      {label}
    </button>
  )
}
