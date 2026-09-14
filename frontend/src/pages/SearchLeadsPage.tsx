import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { RecentSearches } from '@/features/sourcing/components/RecentSearches'
import { SearchForm, type SearchParams } from '@/features/sourcing/components/SearchForm'
import { SearchResultsTable } from '@/features/sourcing/components/SearchResultsTable'
import { StateSearchProgressBar } from '@/features/sourcing/components/StateSearchProgressBar'
import { UsageIndicator } from '@/features/sourcing/components/UsageIndicator'
import {
  useImportSelected,
  useRecentSearches,
  useSearchLeads,
  useSearchState,
  useStateSearchProgress,
} from '@/features/sourcing/hooks/useSourcing'
import { formatNumber } from '@/lib/format'
import type { ImportSelectedResult, SearchRun } from '@/features/sourcing/api/sourcing.api'

export function SearchLeadsPage() {
  const search = useSearchLeads()
  const importSelected = useImportSelected()
  const searchState = useSearchState()
  const { data: stateProgress } = useStateSearchProgress()
  const { data: recent } = useRecentSearches()
  const [imported, setImported] = useState<ImportSelectedResult | null>(null)
  const [preset, setPreset] = useState<{ segmentId: string; city: string; state: string }>()

  const results = search.data?.results ?? []
  const recentRuns = recent?.data ?? []

  function repeatSearch(run: SearchRun) {
    const params = {
      segmentId: run.segment_id ?? 'all',
      city: run.city,
      state: run.state,
    }
    setPreset(params)
    runSearch({
      ...params,
      limit: 20,
      filters: {
        only_without_site: true,
        skip_existing: true,
        require_mobile: false,
        include_blocked: false,
      },
    })
  }

  // Creating a lead sends nothing — the duplicate-contact guarantee lives
  // entirely at the dispatch layer, not here — so every valid result from a
  // search becomes a lead right away. No selection, no extra click: nothing
  // found gets lost. Actually contacting still requires an explicit action
  // per lead, on the Leads page.
  function runSearch(params: SearchParams) {
    setImported(null)
    search.mutate(
      {
        segment_id: params.segmentId,
        city: params.city,
        state: params.state,
        limit: params.limit,
        ...params.filters,
      },
      {
        onSuccess: (outcome) => {
          const candidates = outcome.results.filter((r) => !r.invalid)
          if (candidates.length === 0) return
          importSelected.mutate(
            {
              // With "todos", each candidate carries its own segment, so the
              // import must not force a single one onto all of them.
              segment_id: params.segmentId === 'all' ? undefined : params.segmentId,
              provider: outcome.provider,
              candidates,
            },
            { onSuccess: setImported },
          )
        },
      },
    )
  }

  return (
    <div>
      <PageHeader
        title="Buscar leads"
        description="Encontre empresas por segmento e cidade — os resultados entram direto em Leads"
        actions={<UsageIndicator />}
      />

      <div className="mb-4 rounded-2xl border border-border bg-surface p-6">
        <SearchForm
          isLoading={search.isPending || importSelected.isPending}
          isStateSearchRunning={Boolean(stateProgress?.running)}
          preset={preset}
          onSearch={runSearch}
          onSearchState={(params) =>
            searchState.mutate({
              segment_id: params.segmentId,
              state: params.state,
              cities: params.cities,
              limit: params.limit,
              ...params.filters,
            })
          }
        />
      </div>

      {stateProgress && <StateSearchProgressBar progress={stateProgress} />}

      {search.data?.provider === 'openstreetmap' && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-info-subtle px-3 py-2.5 text-[12.5px] text-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-info" />
          <p>
            Dados reais do OpenStreetMap. Nem toda empresa tem telefone cadastrado publicamente, então
            a lista pode vir mais curta que o esperado. Configure <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px]">GOOGLE_PLACES_API_KEY</code> no
            backend para usar a API oficial do Google Places em vez disso.
          </p>
        </div>
      )}

      {imported && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md bg-success-subtle px-3 py-2.5 text-[12.5px] text-foreground">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-success" />
            {formatNumber(imported.created)} novos, {formatNumber(imported.merged)} atualizados
            {imported.already_contacted > 0 && `, ${formatNumber(imported.already_contacted)} já contatados`}
            {imported.invalid > 0 && `, ${formatNumber(imported.invalid)} sem telefone válido`}
            {' '}adicionados aos Leads.
          </span>
          <Button asChild size="sm" variant="secondary">
            <Link to="/leads">Ver em Leads</Link>
          </Button>
        </div>
      )}

      {results.length === 0 ? (
        !search.isPending &&
        (recentRuns.length > 0 ? (
          <RecentSearches runs={recentRuns} onRepeat={repeatSearch} />
        ) : (
          <EmptyState
            icon={Sparkles}
            title="Nenhuma busca ainda"
            description="Escolha um segmento e uma cidade para encontrar empresas."
          />
        ))
      ) : (
        <>
          <p className="mb-3 text-[13px] text-muted-foreground">
            {formatNumber(results.length)} encontrados
            {importSelected.isPending && ' · adicionando aos Leads…'}
          </p>
          <SearchResultsTable results={results} />
        </>
      )}
    </div>
  )
}
