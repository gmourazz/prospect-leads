import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettings, useUpdateSettings } from '@/features/settings/hooks/useSettings'
import { cn } from '@/lib/cn'

const WEEKDAYS = [
  { iso: 1, label: 'Seg' },
  { iso: 2, label: 'Ter' },
  { iso: 3, label: 'Qua' },
  { iso: 4, label: 'Qui' },
  { iso: 5, label: 'Sex' },
  { iso: 6, label: 'Sáb' },
  { iso: 7, label: 'Dom' },
]

export function SettingsPage() {
  const { data, isLoading } = useSettings()
  const update = useUpdateSettings()
  const [signature, setSignature] = useState('')
  const [dailyLimit, setDailyLimit] = useState(60)

  // The saved value only arrives after the request resolves, and the field
  // must not overwrite what the user is typing once it has.
  useEffect(() => {
    if (data && signature === '') setSignature(data.email_signature)
    if (data) setDailyLimit(data.daily_send_limit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const connected = Boolean(data?.sender_email)
  const weekdays = data?.send_weekdays ?? [1, 2, 3, 4, 5]
  const hourStart = data?.send_hour_start ?? 9
  const hourEnd = data?.send_hour_end ?? 18

  function toggleWeekday(iso: number) {
    const next = weekdays.includes(iso) ? weekdays.filter((d) => d !== iso) : [...weekdays, iso].sort()
    if (next.length === 0) return
    update.mutate({ send_weekdays: next })
  }

  function setHour(key: 'send_hour_start' | 'send_hour_end', value: number) {
    update.mutate({ [key]: value })
  }

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Remetente, ritmo de envio e assinatura usados em todos os emails"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Remetente</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium">
                    <span className={cn('size-2 rounded-full', connected ? 'bg-success' : 'bg-muted-foreground')} />
                    {data?.sender_email || 'não configurado'}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    title="Remetente definido por GMAIL_ADDRESS no backend"
                    onClick={() => toast.info('Remetente é definido por GMAIL_ADDRESS no backend, não por aqui')}
                  >
                    Trocar
                  </Button>
                </div>
                <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                  {connected
                    ? 'Gmail comum entrega até 500 destinatários por dia. Para prospecção fria, comece com 20 a 30 por dia e vá subindo aos poucos.'
                    : 'Defina GMAIL_ADDRESS e GMAIL_APP_PASSWORD no backend para enviar de verdade.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ritmo de envio</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <p>
                  <span className="text-4xl font-bold tabular tracking-tight">{dailyLimit}</span>{' '}
                  <span className="text-[13px] text-muted-foreground">emails por dia</span>
                </p>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  onMouseUp={() => update.mutate({ daily_send_limit: dailyLimit })}
                  onTouchEnd={() => update.mutate({ daily_send_limit: dailyLimit })}
                  className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                />
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>10</span>
                  <span>seguro até 60</span>
                  <span>100</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => toggleWeekday(d.iso)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
                        weekdays.includes(d.iso)
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-transparent bg-muted text-muted-foreground',
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px]">
                  <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={hourStart}
                      onChange={(e) => setHour('send_hour_start', Number(e.target.value))}
                      className="w-8 bg-transparent text-right tabular outline-none"
                    />
                    <span className="text-muted-foreground">h – </span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={hourEnd}
                      onChange={(e) => setHour('send_hour_end', Number(e.target.value))}
                      className="w-8 bg-transparent tabular outline-none"
                    />
                    <span className="text-muted-foreground">h</span>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    {data?.sent_today ?? 0} enviados hoje
                  </span>
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                  Fora desses dias ou desse horário, o botão de enviar lote é recusado. O limite diário
                  acima é só um guia — não bloqueia mais o envio (o teto real é o do próprio Gmail).
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assinatura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Vai no final de todo email, sem precisar repetir nos templates</Label>
              <Textarea
                rows={8}
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder={'--\nSeu nome\nO que você faz'}
                className="font-mono text-[12.5px]"
              />
            </div>
            <Button
              onClick={() => update.mutate({ email_signature: signature })}
              loading={update.isPending}
              disabled={signature === data?.email_signature}
            >
              Salvar assinatura
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prévia do final da mensagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-primary/5 p-4">
              <p className="whitespace-pre-wrap text-[13.5px] italic leading-relaxed text-muted-foreground">
                …texto do template…
              </p>
              <p className="mt-4 whitespace-pre-wrap text-[13.5px] leading-relaxed">
                {signature || '(sem assinatura)'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
