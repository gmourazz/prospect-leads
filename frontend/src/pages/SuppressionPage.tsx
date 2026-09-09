import { ShieldBan } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSuppressions } from '@/features/suppression/hooks/useSuppressions'
import { formatDateTime } from '@/lib/format'

export function SuppressionPage() {
  const { data, isLoading } = useSuppressions()
  const items = data?.data ?? []

  return (
    <div>
      <PageHeader
        title="Não contatar"
        description="Números bloqueados globalmente — nunca reaparecem em novos lotes, mesmo em outra coleta ou segmento"
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShieldBan}
          title="Nenhum número bloqueado"
          description="Quando alguém pedir para não receber mais mensagens, bloqueie o contato na tabela de leads."
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <div className="min-w-0">
                  <p className="font-medium">{item.company_name ?? 'Sem empresa vinculada'}</p>
                  <p className="font-mono text-[12px] text-muted-foreground">{item.phone_display}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">{item.reason}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(item.created_at)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
