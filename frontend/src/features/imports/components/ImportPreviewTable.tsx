import { Badge } from '@/components/ui/badge'
import type { ImportRowView } from '@/types/domain'

const OUTCOME_LABEL: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  created: { label: 'Nova', tone: 'success' },
  merged: { label: 'Atualiza existente', tone: 'info' },
  needs_review: { label: 'Revisar', tone: 'warning' },
  invalid: { label: 'Inválida', tone: 'danger' },
  skipped: { label: 'Ignorada', tone: 'neutral' },
}

export function ImportPreviewTable({ rows }: { rows: ImportRowView[] }) {
  return (
    <div className="scrollbar-thin max-h-[420px] overflow-y-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-muted-foreground">#</th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-muted-foreground">Empresa</th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-muted-foreground">Telefone</th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-muted-foreground">Cidade</th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-muted-foreground">Resultado</th>
            <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-muted-foreground">Contato</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const outcome = OUTCOME_LABEL[row.outcome] ?? { label: row.outcome, tone: 'neutral' as const }
            return (
              <tr key={row.row_number} className="border-b border-border/70 last:border-0">
                <td className="px-3 py-2 text-muted-foreground">{row.row_number}</td>
                <td className="px-3 py-2 font-medium">{row.company_name || '—'}</td>
                <td className="px-3 py-2 font-mono text-[12px]">{row.phone_display || '—'}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.city || '—'}</td>
                <td className="px-3 py-2">
                  <Badge variant={outcome.tone}>{outcome.label}</Badge>
                  {row.errors.length > 0 && (
                    <p className="mt-0.5 text-[11px] text-danger">{row.errors.join('; ')}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  {row.already_contacted ? (
                    <Badge variant="success">✓ já contatado</Badge>
                  ) : (
                    <span className="text-muted-foreground">novo</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
