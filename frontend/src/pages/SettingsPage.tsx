import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useSettings, useUpdateSettings } from '@/features/settings/hooks/useSettings'

export function SettingsPage() {
  const { data, isLoading } = useSettings()
  const update = useUpdateSettings()
  const [signature, setSignature] = useState('')

  // The saved value only arrives after the request resolves, and the field
  // must not overwrite what the user is typing once it has.
  useEffect(() => {
    if (data && signature === '') setSignature(data.email_signature)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const connected = Boolean(data?.sender_email)

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Remetente e assinatura usados em todos os emails"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Remetente</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-5 w-56" />
            ) : (
              <>
                <p className="flex items-center gap-2 text-[13.5px] font-medium">
                  <Mail className={connected ? 'size-4 text-success' : 'size-4 text-muted-foreground'} />
                  {data?.sender_email || 'não configurado'}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {connected
                    ? 'Os emails saem por esta conta. Gmail comum entrega até 500 destinatários por dia; para prospecção fria, comece com 20 a 30 por dia e vá subindo aos poucos.'
                    : 'Defina GMAIL_ADDRESS e GMAIL_APP_PASSWORD no backend para enviar de verdade.'}
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prévia do final da mensagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border bg-surface p-4">
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted-foreground">
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
