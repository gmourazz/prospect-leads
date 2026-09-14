import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useDailyQuota, useSearchUsage } from '@/features/sourcing/hooks/useSourcing'
import { formatDateTime, formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'

const PROVIDER_LABEL: Record<string, string> = {
  google_places: 'Google Places',
  openstreetmap: 'OpenStreetMap',
}

export function QuotaPage() {
  const { data: quota, isLoading: quotaLoading } = useDailyQuota()
  const { data: usage } = useSearchUsage()

  return (
    <div>
      <PageHeader
        title="Cota de busca"
        description="Status real da API que traz os leads em Buscar leads — pra saber antes de tentar de novo"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cota diária (o que realmente trava a busca)</CardTitle>
          </CardHeader>
          <CardContent>
            {quotaLoading || !quota ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[13.5px] font-medium">
                    {PROVIDER_LABEL[quota.provider] ?? quota.provider}
                  </p>
                  {quota.exceeded ? (
                    <Badge variant="danger">
                      <AlertTriangle /> Esgotada hoje
                    </Badge>
                  ) : (
                    <Badge variant="success">
                      <CheckCircle2 /> Disponível
                    </Badge>
                  )}
                </div>

                <p className="mt-3 text-3xl font-bold tabular tracking-tight">
                  {formatNumber(quota.call_count)}
                  <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">
                    tentativas hoje
                  </span>
                </p>

                {quota.exceeded ? (
                  <div
                    className={cn(
                      'mt-3 flex items-start gap-2 rounded-md bg-danger-subtle px-3 py-2.5 text-[12.5px] text-danger',
                    )}
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Cota diária esgotada
                      {quota.exceeded_at && ` às ${formatDateTime(quota.exceeded_at)}`}. Novas buscas vão
                      falhar até resetar — não vale a pena tentar de novo antes de{' '}
                      <strong>{formatDateTime(quota.resets_at)}</strong> (meia-noite no horário do
                      Pacífico, EUA).
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                    Reseta todo dia à meia-noite no horário do Pacífico (EUA) — por volta de{' '}
                    {formatDateTime(quota.resets_at)} no seu horário. O limite padrão do Google sem
                    faturamento ativado costuma ser bem baixo (100/dia); ativando faturamento no
                    Google Cloud Console ele sobe bastante.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cota mensal (informativa)</CardTitle>
          </CardHeader>
          <CardContent>
            {!usage ? (
              <Skeleton className="h-24 w-full" />
            ) : !usage.is_billed ? (
              <p className="text-[13px] text-muted-foreground">
                {formatNumber(usage.call_count)} buscas este mês · OpenStreetMap (grátis, sem limite)
              </p>
            ) : (
              <>
                <p className="text-3xl font-bold tabular tracking-tight">
                  {formatNumber(usage.call_count)}
                  <span className="text-[15px] font-normal text-muted-foreground">
                    {' '}
                    / {formatNumber(usage.free_quota)}
                  </span>
                </p>
                <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                  Esse número só soma buscas que <strong>deram certo</strong> — ele nunca vai avisar
                  que a cota diária estourou, porque tentativas recusadas pelo Google não entram na
                  conta. Para saber se dá pra buscar agora, use o card ao lado, não este.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
