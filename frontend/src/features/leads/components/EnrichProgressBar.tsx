import { CheckCircle2, Loader2, MailSearch } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { EnrichProgress } from '../api/leads.api'

// Discovery runs for minutes in the background. Without this the user clicks
// the button, sees an unchanged list, and has no way to tell whether
// anything is happening.
export function EnrichProgressBar({ progress }: { progress: EnrichProgress }) {
  const { running, total, processed, remaining, leads_with_email, emails_found } = progress

  // Nothing ever ran and nothing is missing: no reason to take up space.
  if (!running && total === 0 && remaining === 0) return null

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0

  return (
    <div className="mb-4 rounded-md border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[13px] font-medium">
          {running ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : emails_found > 0 ? (
            <CheckCircle2 className="size-4 text-success" />
          ) : (
            <MailSearch className="size-4 text-muted-foreground" />
          )}
          {running
            ? `Buscando emails: ${formatNumber(processed)} de ${formatNumber(total)}`
            : total > 0
              ? `Busca concluída: ${formatNumber(emails_found)} email(s) em ${formatNumber(leads_with_email)} lead(s)`
              : 'Nenhuma busca rodando'}
        </p>
        <p className="text-[12px] text-muted-foreground">
          {formatNumber(remaining)} lead(s) ainda sem email
        </p>
      </div>

      {running && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {running && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          {formatNumber(emails_found)} encontrado(s) até agora. Pode sair desta tela, a busca continua.
        </p>
      )}
    </div>
  )
}
