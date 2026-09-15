import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatNumber } from '@/lib/format'

const PAGE_SIZES = [20, 25, 50, 100, 200]

export function Pagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
}: {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const start = total === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13px]">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>Itens por página</span>
        <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
          <SelectTrigger className="h-8 w-[72px] rounded-full border-transparent bg-muted px-3"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>{size}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <span className="tabular text-muted-foreground">
          {formatNumber(start)}–{formatNumber(end)} de {formatNumber(total)}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="secondary" size="icon-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft />
          </Button>
          <span className="tabular px-1 text-muted-foreground">
            {page} / {formatNumber(totalPages)}
          </span>
          <Button
            variant="secondary" size="icon-sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
