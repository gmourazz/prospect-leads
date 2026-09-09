import { cn } from '@/lib/cn'

const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'never', label: 'Não contatados' },
  { value: 'contacted', label: 'Já contatados' },
  { value: 'replied', label: 'Responderam' },
  { value: 'suppressed', label: 'Bloqueados' },
]

export function QuickFilters({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          onClick={() => onChange(f.value || undefined)}
          className={cn(
            'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
            (value ?? '') === f.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
