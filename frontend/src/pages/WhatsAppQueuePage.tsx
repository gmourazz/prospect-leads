import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  QrCode,
  Send,
  Trash2,
  WifiOff,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import {
  useClearWhatsAppQueue,
  usePauseWhatsApp,
  useWhatsAppQueue,
} from '@/features/whatsapp/hooks/useWhatsAppQueue'
import type { WhatsAppConnection } from '@/features/whatsapp/api/whatsapp.api'
import { formatDateTime, formatNumber } from '@/lib/format'

/**
 * Painel da fila automática. Existe porque o envio acontece fora da tela: sem
 * isso, a única forma de saber se o bridge está vivo seria olhar o terminal.
 */
export function WhatsAppQueuePage() {
  const { data, isLoading } = useWhatsAppQueue()
  const pause = usePauseWhatsApp()
  const clear = useClearWhatsAppQueue()

  const state = data?.state
  const counts = data?.counts
  const rules = data?.rules

  return (
    <div>
      <PageHeader
        title="Fila do WhatsApp"
        description="Envio automático pelo bridge local — uma mensagem por vez, no ritmo configurado"
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => clear.mutate()}
              loading={clear.isPending}
              disabled={!counts || counts.queued === 0}
            >
              <Trash2 />
              Limpar fila
            </Button>
            <Button
              variant={state?.paused ? 'default' : 'secondary'}
              size="sm"
              onClick={() => pause.mutate(!state?.paused)}
              loading={pause.isPending}
              disabled={!state}
            >
              {state?.paused ? <Play /> : <Pause />}
              {state?.paused ? 'Liberar envio' : 'Pausar'}
            </Button>
          </>
        }
      />

      {isLoading || !state || !counts || !rules ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-4">
          {state.paused && (
            <div className="flex items-start gap-2 rounded-lg bg-warning-subtle px-4 py-3 text-[13px] text-warning">
              <Pause className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>Fila pausada</strong>
                {state.pause_reason ? ` — ${state.pause_reason}.` : '.'} Nenhuma mensagem sai enquanto
                estiver assim.
              </span>
            </div>
          )}

          {(state.connection === 'logged_out' || state.connection === 'blocked') && (
            <div className="flex items-start gap-2 rounded-lg bg-danger-subtle px-4 py-3 text-[13px] text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {state.connection === 'blocked'
                  ? 'O WhatsApp restringiu este número. Não reconecte antes de entender o motivo — insistir agora costuma piorar.'
                  : 'A sessão do WhatsApp foi desconectada. Rode o bridge de novo e escaneie o QR code.'}
                {state.last_error && (
                  <span className="mt-1 block opacity-80">Detalhe técnico: {state.last_error}</span>
                )}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Bridge</CardTitle>
              </CardHeader>
              <CardContent>
                <ConnectionBadge connection={state.connection} />
                <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                  {CONNECTION_HELP[state.connection]}
                </p>
                {state.last_heartbeat_at && (
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Último sinal: {formatDateTime(state.last_heartbeat_at)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fila</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular tracking-tight">
                  {formatNumber(counts.queued)}
                  <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">
                    aguardando
                  </span>
                </p>
                <p className="mt-3 text-[12.5px] text-muted-foreground">
                  {formatNumber(counts.sent_today)} de {rules.wa_daily_limit} enviadas hoje ·{' '}
                  {formatNumber(counts.failed)} falha(s)
                </p>
                {!state.paused && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Clock className="size-3.5" />
                    Próxima liberada em {formatDateTime(state.next_allowed_at)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ritmo</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-[12.5px] text-muted-foreground">
                  <li>
                    Intervalo: {rules.wa_min_interval_sec}–{rules.wa_max_interval_sec}s
                  </li>
                  <li>
                    Pausa longa: {rules.wa_burst_pause_min} min a cada {rules.wa_burst_size}
                  </li>
                  <li>Teto diário: {rules.wa_daily_limit}</li>
                  <li>
                    Janela: {rules.wa_hour_start}h–{rules.wa_hour_end}h
                  </li>
                </ul>
                <p className="mt-3 text-[12px] text-muted-foreground">
                  Ajuste em Configurações. Aumentar esses números aumenta o risco de restrição.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Últimos envios</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recent.length === 0 ? (
                <EmptyState
                  icon={Send}
                  title="Nada enviado ainda"
                  description="Selecione leads na tela de Leads e escolha Enviar automático."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {data.recent.map((item) => (
                    <li key={item.dispatch_id} className="flex items-start gap-3 py-2.5">
                      <StatusIcon status={item.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{item.company_name}</p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {item.phone_display}
                          {item.error_message && ` · ${item.error_message}`}
                          {!item.error_message && item.body_preview && ` · ${item.body_preview}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12px] tabular text-muted-foreground">
                        {formatDateTime(item.sent_at ?? item.updated_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

const CONNECTION_HELP: Record<WhatsAppConnection, string> = {
  offline: 'O bridge não está rodando. Abra um terminal em whatsapp-bridge e rode npm start.',
  connecting: 'Conectando à sessão do WhatsApp Web.',
  qr_required: 'O bridge está esperando você escanear o QR code no terminal dele.',
  connected: 'Sessão ativa. A fila anda enquanto este terminal estiver aberto.',
  logged_out: 'A sessão foi encerrada. Rode o bridge de novo e pareie o aparelho.',
  blocked: 'O WhatsApp restringiu este número.',
}

function ConnectionBadge({ connection }: { connection: WhatsAppConnection }) {
  switch (connection) {
    case 'connected':
      return (
        <Badge variant="success">
          <CheckCircle2 /> Conectado
        </Badge>
      )
    case 'qr_required':
      return (
        <Badge variant="warning">
          <QrCode /> Aguardando QR
        </Badge>
      )
    case 'connecting':
      return (
        <Badge variant="warning">
          <Clock /> Conectando
        </Badge>
      )
    case 'blocked':
      return (
        <Badge variant="danger">
          <Ban /> Restringido
        </Badge>
      )
    case 'logged_out':
      return (
        <Badge variant="danger">
          <WifiOff /> Desconectado
        </Badge>
      )
    default:
      return (
        <Badge variant="neutral">
          <WifiOff /> Offline
        </Badge>
      )
  }
}

function StatusIcon({ status }: { status: 'sent' | 'failed' | 'sending' }) {
  if (status === 'sent') return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
  if (status === 'failed') return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
  return <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
}
