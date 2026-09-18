import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface DateRange {
  from?: string
  to?: string
}

interface DateRangeFilterProps {
  value: DateRange
  onChange: (value: DateRange) => void
  className?: string
}

/** A "De/Até" date-range filter, plain inputs kept deliberately simple —
 * there's no reusable calendar/popover component in the design system yet. */
export function DateRangeFilter({ value, onChange, className = '' }: DateRangeFilterProps) {
  const hasRange = Boolean(value.from || value.to)

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        De
        <Input
          type="date"
          value={value.from ?? ''}
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
          className="h-8 w-[150px] text-[12.5px]"
        />
      </label>
      <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        Até
        <Input
          type="date"
          value={value.to ?? ''}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
          className="h-8 w-[150px] text-[12.5px]"
        />
      </label>
      {hasRange && (
        <Button size="sm" variant="ghost" onClick={() => onChange({})} className="h-8 px-2">
          <X className="size-3.5" /> Limpar
        </Button>
      )}
    </div>
  )
}
