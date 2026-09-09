import { CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Batch, DispatchResult } from '@/types/domain'

export function BatchResultSummary({ batch, results }: { batch: Batch; results: DispatchResult[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lote #{batch.sequence_no}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-4 text-[13px]">
          <span className="flex items-center gap-1.5 text-success">
            <CheckCircle2 className="size-4" /> {batch.sent_count} enviadas
          </span>
          {batch.failed_count > 0 && (
            <span className="flex items-center gap-1.5 text-danger">
              <XCircle className="size-4" /> {batch.failed_count} falharam
            </span>
          )}
        </div>
        <ul className="scrollbar-thin max-h-56 space-y-1.5 overflow-y-auto pt-1 text-[12.5px]">
          {results.map((r) => (
            <li key={r.dispatch_id} className="flex items-center justify-between gap-2">
              <span className="truncate">{r.company_name}</span>
              {r.status === 'sent' ? (
                <span className="shrink-0 text-success">enviado</span>
              ) : (
                <span className="shrink-0 text-danger" title={r.error_message ?? ''}>falhou</span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
