import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
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
import { useTemplates } from '@/features/templates/hooks/useTemplates'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'
import { SEGMENT_COLOR_HEX as COLOR_SWATCHES, initials, segmentTint } from '@/lib/segment-colors'

export function SegmentsPage() {
  const { data } = useSegments()
  const { data: templatesData } = useTemplates()
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
        description="Verticais de prospecção — cada uma define o template padrão"
        actions={<Button size="sm" onClick={() => setOpen(true)}><Plus /> Novo segmento</Button>}
      />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {data?.data.map((segment) => {
          const swatch = COLOR_SWATCHES[segment.color] ?? COLOR_SWATCHES.slate
          const defaultTemplate = templatesData?.data.find((t) => t.segment_id === segment.id)
          return (
            <Card key={segment.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[12.5px] font-bold"
                    style={{ backgroundColor: segmentTint(segment.color), color: swatch }}
                  >
                    {initials(segment.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{segment.name}</p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {formatNumber(segment.lead_count)} lead{segment.lead_count === 1 ? '' : 's'} ·{' '}
                      {defaultTemplate ? `template ${defaultTemplate.name}` : 'sem template padrão'}
                    </p>
                  </div>
                  <Switch
                    checked={segment.is_active}
                    onCheckedChange={(checked) =>
                      updateSegment.mutate({ id: segment.id, is_active: checked })
                    }
                    aria-label={`Ativar ${segment.name}`}
                  />
                </div>
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
