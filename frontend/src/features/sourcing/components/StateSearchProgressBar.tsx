import { Ban, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'
import { useCancelStateSearch } from '../hooks/useSourcing'
import type { StateSearchProgress } from '../api/sourcing.api'

// Mirrors EnrichProgressBar: a run that can take many minutes needs
// something on screen the whole time, not just a toast when it kicks off.
export function StateSearchProgressBar({ progress }: { progress: StateSearchProgress }) {
  const cancel = useCancelStateSearch()
  const { running, state, total_cities, processed_cities, current_city, leads_found, cancelled } = progress

  if (!running && total_cities === 0) return null

  const pct = total_cities > 0 ? Math.round((processed_cities / total_cities) * 100) : 0

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          {running ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : cancelled ? (
            <Ban className="size-4 text-muted-foreground" />
          ) : (
            <CheckCircle2 className="size-4 text-success" />
          )}
          {running
            ? `Buscando em ${state}: ${formatNumber(processed_cities)} de ${formatNumber(total_cities)} cidades`
            : cancelled
              ? `Cancelada: ${formatNumber(processed_cities)} de ${formatNumber(total_cities)} cidades feitas`
              : `Busca no estado concluída: ${formatNumber(processed_cities)} cidade(s)`}
        </p>
        <div className="flex items-center gap-3">
          <p className="text-[12px] text-muted-foreground">
            {formatNumber(leads_found)} lead(s) adicionados
          </p>
          {running && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => cancel.mutate()}
              loading={cancel.isPending}
              disabled={cancel.isPending}
            >
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {running && (
        <>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Cidade atual: {current_city || '—'}. Pode sair desta tela, a busca continua.
          </p>
        </>
      )}
    </div>
  )
}
