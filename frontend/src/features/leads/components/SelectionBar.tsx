import { MessageCircle, Send, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'

export function SelectionBar({
  count,
  onClear,
  onCreateCampaign,
  onSendWhatsApp,
  onQueueWhatsApp,
}: {
  count: number
  onClear: () => void
  onCreateCampaign: () => void
  /** Abre uma conversa por vez, com a pessoa presente. */
  onSendWhatsApp?: () => void
  /** Enfileira para o bridge enviar sozinho. */
  onQueueWhatsApp?: () => void
}) {
  if (count === 0) return null
  return (
    <div className="sticky bottom-4 z-10 mx-auto flex w-fit animate-slide-up items-center gap-3 rounded-full border border-primary/30 bg-surface px-4 py-2.5 shadow-overlay">
      <span className="text-[13px] font-bold tabular text-accent-foreground">
        {formatNumber(count)} selecionado{count > 1 ? 's' : ''}
      </span>
      <Button size="sm" onClick={onCreateCampaign}>
        <Send />
        Criar campanha
      </Button>
      {onQueueWhatsApp && (
        <Button size="sm" variant="secondary" onClick={onQueueWhatsApp}>
          <Zap />
          Enviar automático
        </Button>
      )}
      {onSendWhatsApp && (
        <Button size="sm" variant="secondary" onClick={onSendWhatsApp}>
          <MessageCircle />
          Chamar no WhatsApp
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Limpar seleção">
        <X />
      </Button>
    </div>
  )
}
