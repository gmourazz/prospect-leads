import { AlertTriangle, CheckCircle2, GitMerge, History, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatNumber } from '@/lib/format'
import type { ImportPreview } from '@/types/domain'

export function ImportSummary({ preview }: { preview: ImportPreview }) {
  const items = [
    { label: 'Novas empresas', value: preview.will_create, icon: Sparkles, tone: 'success' as const },
    { label: 'Empresas atualizadas', value: preview.will_merge, icon: GitMerge, tone: 'info' as const },
    { label: 'Já contatados', value: preview.already_contacted, icon: History, tone: 'warning' as const },
    { label: 'Precisam revisão', value: preview.needs_review, icon: AlertTriangle, tone: 'warning' as const },
    { label: 'Inválidas', value: preview.invalid, icon: AlertTriangle, tone: 'danger' as const },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex flex-col gap-1.5 p-3.5">
            <item.icon
              className={{
                success: 'size-4 text-success',
                info: 'size-4 text-info',
                warning: 'size-4 text-warning',
                danger: 'size-4 text-danger',
              }[item.tone]}
            />
            <p className="text-lg font-semibold tabular">{formatNumber(item.value)}</p>
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
          </CardContent>
        </Card>
      ))}
      {preview.already_contacted > 0 && (
        <div className="col-span-full flex items-center gap-2 rounded-md bg-success-subtle px-3 py-2 text-[12.5px] text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          {formatNumber(preview.already_contacted)} destes contatos já receberam mensagem antes — eles
          continuarão marcados como já contatados, não como novos.
        </div>
      )}
    </div>
  )
}
