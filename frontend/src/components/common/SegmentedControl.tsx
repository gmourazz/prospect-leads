import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly { value: T; label: string; icon?: LucideIcon }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-full bg-muted p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0',
            value === o.value
              ? 'bg-surface text-foreground shadow-subtle'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.icon && <o.icon />}
          {o.label}
        </button>
      ))}
    </div>
  )
}
