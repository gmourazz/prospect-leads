import { useState, type FormEvent } from 'react'
import * as Icons from 'lucide-react'
import { Plus, Tag } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCreateSegment, useSegments, useUpdateSegment } from '@/features/segments/hooks/useSegments'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'

const COLOR_SWATCHES: Record<string, string> = {
  slate: '#64748b', amber: '#d97706', sky: '#0284c7', cyan: '#0891b2',
  lime: '#65a30d', violet: '#7c3aed', rose: '#e11d48', emerald: '#059669',
}

export function SegmentsPage() {
  const { data } = useSegments()
  const createSegment = useCreateSegment()
  const updateSegment = useUpdateSegment()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<keyof typeof COLOR_SWATCHES>('slate')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    createSegment.mutate(
      { name, color, icon: 'Tag' },
      { onSuccess: () => { setOpen(false); setName(''); setColor('slate') } },
    )
  }

  return (
    <div>
      <PageHeader
        title="Segmentos"
        description="Verticais de prospecção, cadastráveis a qualquer momento"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus /> Novo segmento</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.data.map((segment) => {
          const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[segment.icon] ?? Tag
          const swatch = COLOR_SWATCHES[segment.color] ?? COLOR_SWATCHES.slate
          return (
            <Card key={segment.id}>
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: `${swatch}1a`, color: swatch }}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{segment.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {formatNumber(segment.lead_count)} lead{segment.lead_count === 1 ? '' : 's'}
                  </p>
                </div>
                <Switch
                  checked={segment.is_active}
                  onCheckedChange={(checked) =>
                    updateSegment.mutate({ id: segment.id, is_active: checked })
                  }
                  aria-label={`Ativar ${segment.name}`}
                />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Novo segmento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 px-6 pb-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Fisioterapeuta" />
              </div>
              <div className="space-y-1.5">
                <Label>Cor</Label>
                <div className="flex gap-1.5">
                  {Object.entries(COLOR_SWATCHES).map(([token, hex]) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => setColor(token)}
                      className={cn(
                        'size-6 rounded-full border-2 transition-transform',
                        color === token ? 'scale-110 border-foreground' : 'border-transparent',
                      )}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" loading={createSegment.isPending}>Criar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
