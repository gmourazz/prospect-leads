import { useState, type FormEvent } from 'react'
import { ShieldBan } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBlockPhone, useSuppressions } from '@/features/suppression/hooks/useSuppressions'
import { formatDateTime } from '@/lib/format'

export function SuppressionPage() {
  const { data, isLoading } = useSuppressions()
  const blockPhone = useBlockPhone()
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const items = data?.data ?? []

  function handleBlock(e: FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return
    blockPhone.mutate(
      { phone, reason: reason.trim() || undefined },
      { onSuccess: () => { setPhone(''); setReason('') } },
    )
  }

  return (
    <div>
      <PageHeader
        title="Não contatar"
        description="Números bloqueados globalmente — nunca reaparecem em novos lotes, mesmo em outra coleta ou segmento"
      />

      <Card className="mb-4">
        <CardContent className="p-5">
          <form onSubmit={handleBlock} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(34) 90000-0000"
              className="h-11 flex-1 rounded-xl border-transparent bg-muted"
            />
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo (opcional)"
              className="h-11 flex-[2] rounded-xl border-transparent bg-muted"
            />
            <Button type="submit" size="default" className="h-11 shrink-0" loading={blockPhone.isPending}>
              Bloquear número
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-20 text-center">
          <div className="flex size-11 items-center justify-center rounded-[10px] bg-primary/10">
            <ShieldBan className="size-5 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Nenhum número bloqueado</p>
            <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Quando alguém pedir para não receber mais mensagens, bloqueie o contato pela tabela de leads — o
              número entra aqui na hora.
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
                  <p className="tabular text-[12px] text-muted-foreground">{item.phone_display}</p>
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
