import { useState } from 'react'
import { Clock, MessageCircle, ThumbsUp } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FollowupDialog } from '@/features/followup/components/FollowupDialog'
import { useAwaitingReply, useMarkReplied } from '@/features/followup/hooks/useFollowup'
import { formatNumber } from '@/lib/format'
import type { AwaitingReply } from '@/features/followup/api/followup.api'

const DAY_OPTIONS = [
  { value: '1', label: 'há mais de 1 dia' },
  { value: '3', label: 'há mais de 3 dias' },
  { value: '7', label: 'há mais de 7 dias' },
  { value: '14', label: 'há mais de 14 dias' },
]

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

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Ninguém aguardando ainda"
          description="Assim que uma campanha de email for enviada, quem não responder aparece aqui para o follow-up."
        />
      ) : (
        <>
          <p className="mb-3 text-[13px] text-muted-foreground">
            {formatNumber(pending.length)} sem follow-up
            {rows.length !== pending.length &&
              ` · ${formatNumber(rows.length - pending.length)} já receberam WhatsApp`}
          </p>

          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border">
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
                      <p className="font-mono text-[12.5px] tabular">{r.phone_display}</p>
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
