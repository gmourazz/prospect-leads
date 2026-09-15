import { Ban, CheckCheck, Clock, MessageCircleReply, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import type { LeadCounts } from '@/types/domain'

const FILTERS = [
  { value: '', label: 'Todos', icon: Users },
  { value: 'never', label: 'Não contatados', icon: Clock },
  { value: 'contacted', label: 'Já contatados', icon: CheckCheck },
  { value: 'replied', label: 'Responderam', icon: MessageCircleReply },
  { value: 'suppressed', label: 'Bloqueados', icon: Ban },
] as const

export function QuickFilters({
  value,
  counts,
  onChange,
}: {
  value: string | undefined
  counts: LeadCounts | undefined
  onChange: (value: string | undefined) => void
}) {
  const countFor = (filterValue: string): number | undefined => {
    if (!counts) return undefined
    switch (filterValue) {
      case '':
        return counts.total
      case 'never':
        return Math.max(counts.total - counts.contacted - counts.replied - counts.suppressed, 0)
      case 'contacted':
        return counts.contacted
      case 'replied':
        return counts.replied
      case 'suppressed':
        return counts.suppressed
      default:
        return undefined
    }
  }

  return (
    <div className="flex flex-nowrap items-center gap-2">
      {FILTERS.map((f) => {
        const active = (value ?? '') === f.value
        const count = countFor(f.value)
        return (
          <button
            key={f.value}
            onClick={() => onChange(f.value || undefined)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0',
              active
                ? 'border-[#7c3aed] bg-primary/[0.16] text-primary'
                : 'border-transparent bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <f.icon />
            {f.label}
            {count !== undefined && <span className="tabular">{formatNumber(count)}</span>}
          </button>
        )
      })}
    </div>
  )
}
