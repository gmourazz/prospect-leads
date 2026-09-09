import { Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'

export function SelectionBar({
  count,
  onClear,
  onCreateCampaign,
}: {
  count: number
  onClear: () => void
  onCreateCampaign: () => void
}) {
  if (count === 0) return null
  return (
    <div className="sticky bottom-4 z-10 mx-auto flex w-fit animate-slide-up items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 shadow-overlay">
      <span className="text-[13px] font-medium tabular">
        {formatNumber(count)} selecionado{count > 1 ? 's' : ''}
      </span>
      <Button size="sm" onClick={onCreateCampaign}>
        <Send />
        Criar campanha
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Limpar seleção">
        <X />
      </Button>
    </div>
  )
}
