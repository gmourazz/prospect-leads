import { Star, StarOff } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useInterested } from '@/features/interested/hooks/useInterested'
import { useUnmarkInterested } from '@/features/leads/hooks/useLeads'
import { formatDateTime } from '@/lib/format'

export function InterestedPage() {
  const { data, isLoading } = useInterested()
  const unmark = useUnmarkInterested()
  const items = data?.data ?? []

  return (
    <div>
      <PageHeader
        title="Interessados"
        description="Contatos marcados como 'demonstrou interesse' — ficam separados aqui pra remarketing futuro, mesmo se a fila do WhatsApp cair"
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-20 text-center">
          <div className="flex size-11 items-center justify-center rounded-[10px] bg-primary/10">
            <Star className="size-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Nenhum interessado marcado ainda</p>
            <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Marque "Demonstrou interesse" na tabela de leads quando um contato responder bem — ele entra aqui na
              hora.
            </p>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                <div className="min-w-0">
                  <p className="font-medium">{item.company_name ?? 'Sem empresa vinculada'}</p>
                  <p className="font-mono text-[12px] text-muted-foreground">{item.phone_display}</p>
                  {item.note && <p className="mt-0.5 text-[12px] text-muted-foreground">{item.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(item.created_at)}</p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remover interesse"
                    loading={unmark.isPending}
                    onClick={() => unmark.mutate(item.contact_point_id)}
                  >
                    <StarOff />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
