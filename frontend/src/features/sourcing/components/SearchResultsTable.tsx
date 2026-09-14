import { AlertCircle, Building2, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { SearchCandidate } from '../api/sourcing.api'

export function SearchResultsTable({ results }: { results: SearchCandidate[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Empresa
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Telefone
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Segmento
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Cidade
            </th>
            <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Situação
            </th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr
              key={r.external_id}
              className="h-11 border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40"
            >
              <td className="px-4 py-2 font-medium">{r.company_name}</td>
              <td className="px-4 py-2 font-mono text-[12.5px] tabular">
                {r.phone_display || <span className="text-danger">inválido</span>}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{r.segment_name || '—'}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {r.city}{r.state ? `/${r.state}` : ''}
              </td>
              <td className="px-4 py-2">
                <div className="flex flex-wrap gap-1.5">
                  {r.already_contacted && (
                    <Badge variant="success"><History /> já contatado</Badge>
                  )}
                  {r.existing_company && (
                    <Badge variant="info"><Building2 /> já cadastrada</Badge>
                  )}
                  {r.invalid && (
                    <Badge variant="danger"><AlertCircle /> sem telefone válido</Badge>
                  )}
                  {!r.already_contacted && !r.existing_company && !r.invalid && (
                    <Badge variant="neutral">novo</Badge>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
