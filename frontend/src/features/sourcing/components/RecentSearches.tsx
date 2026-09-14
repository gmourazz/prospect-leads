import { Button } from '@/components/ui/button'
import { formatDayRelative, formatNumber, pluralize } from '@/lib/format'
import type { SearchRun } from '../api/sourcing.api'

export function RecentSearches({
  runs,
  onRepeat,
}: {
  runs: SearchRun[]
  onRepeat: (run: SearchRun) => void
}) {
  if (runs.length === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-semibold">Buscas recentes</h2>
        <p className="text-[12.5px] text-muted-foreground">reexecute em um clique</p>
      </div>

      <ul>
        {runs.map((run) => (
          <li
            key={run.id}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/60 py-3.5 first:border-t-0"
          >
            <p className="min-w-0 flex-1 truncate text-[14px] font-medium">
              {run.segment_label} · {run.city}/{run.state}
            </p>
            <p className="shrink-0 text-[13px] tabular">
              {formatNumber(run.leads_found)} {pluralize(run.leads_found, 'lead', 'leads')}
            </p>
            <p className="w-32 shrink-0 text-[13px] text-muted-foreground">
              {formatDayRelative(run.created_at)}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-primary/40 text-primary hover:bg-primary/5"
              onClick={() => onRepeat(run)}
            >
              Repetir
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
