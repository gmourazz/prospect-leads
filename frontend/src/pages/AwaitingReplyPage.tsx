import { useState } from 'react'
import { Clock, MessageCircle, ThumbsUp } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FollowupDialog } from '@/features/followup/components/FollowupDialog'
import { useAwaitingReply, useMarkReplied } from '@/features/followup/hooks/useFollowup'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { AwaitingReply } from '@/features/followup/api/followup.api'

const DAY_OPTIONS = [
  { value: '1', label: 'há mais de 1 dia' },
  { value: '3', label: 'há mais de 3 dias' },
  { value: '7', label: 'há mais de 7 dias' },
  { value: '14', label: 'há mais de 14 dias' },
]

const STEPS = [
  {
    number: 1,
    tone: 'bg-primary/10 text-primary',
    title: 'Email sai da campanha',
    description: 'O lead entra em espera assim que o envio é confirmado.',
  },
  {
    number: 2,
    tone: 'bg-warning-subtle text-warning',
    title: 'Silêncio pelo período escolhido',
    description: 'Sem resposta na janela escolhida, ele aparece nesta lista.',
  },
  {
    number: 3,
    tone: 'bg-success-subtle text-success',
    title: 'Follow-up no WhatsApp',
    description: 'Você abre a conversa com a mensagem já preenchida.',
  },
] as const

export function AwaitingReplyPage() {
  const [minDays, setMinDays] = useState('3')
  const [followup, setFollowup] = useState<AwaitingReply | null>(null)
  const { data, isLoading } = useAwaitingReply(Number(minDays))
  const markReplied = useMarkReplied()

  const rows = data?.data ?? []
  const pending = rows.filter((r) => !r.whatsapp_sent)

  return (
    <div>
      <PageHeader
        title="Aguardando resposta"
        description="Quem recebeu o email e ainda não respondeu — a segunda tentativa vai por WhatsApp, enviada por você"
        actions={
          <Select value={minDays} onValueChange={setMinDays}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DAY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.number} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
                  step.tone,
                )}
              >
                {step.number}
              </span>
              <p className="text-[13.5px] font-semibold">{step.title}</p>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-20 text-center">
          <div className="flex size-11 items-center justify-center rounded-[10px] bg-primary/10">
            <Clock className="size-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Ninguém aguardando ainda</p>
            <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Os follow-ups aparecem aqui a partir de {minDays} dia{minDays === '1' ? '' : 's'} depois do envio do
              email, se ninguém tiver respondido.
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-muted-foreground">
            {formatNumber(pending.length)} sem follow-up
            {rows.length !== pending.length &&
              ` · ${formatNumber(rows.length - pending.length)} já receberam WhatsApp`}
          </p>

          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <Th>Empresa</Th>
                  <Th>Contato</Th>
                  <Th>Email enviado</Th>
                  <Th>Situação</Th>
                  <Th className="w-[220px]" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.lead_id}
                    className="h-12 border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <Td>
                      <p className="font-medium">{r.company_name}</p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {r.city ? `${r.city}/${r.state ?? ''}` : '—'}
                        {r.segment_name ? ` · ${r.segment_name}` : ''}
                      </p>
                    </Td>
                    <Td>
                      <p className="text-[12.5px] tabular">{r.phone_display}</p>
                      <p className="truncate text-[11.5px] text-muted-foreground">{r.email ?? '—'}</p>
                    </Td>
                    <Td className="text-muted-foreground">
                      há {r.days_since_email} dia(s)
                    </Td>
                    <Td>
                      {r.whatsapp_sent ? (
                        <Badge variant="success">follow-up enviado</Badge>
                      ) : (
                        <Badge variant="warning">sem resposta</Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        {!r.whatsapp_sent && (
                          <Button size="sm" onClick={() => setFollowup(r)}>
                            <MessageCircle /> WhatsApp
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            markReplied.mutate({ contactPointId: r.contact_point_id })
                          }
                        >
                          <ThumbsUp /> Respondeu
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {followup && (
        <FollowupDialog
          lead={followup}
          open={followup !== null}
          onOpenChange={(open) => !open && setFollowup(null)}
        />
      )}
    </div>
  )
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${className}`}>
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2 align-middle ${className}`}>{children}</td>
}
