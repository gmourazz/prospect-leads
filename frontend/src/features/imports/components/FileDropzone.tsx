import { useCallback, useState, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function FileDropzone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: DragEvent<HTMLLabelElement>) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-16 text-center transition-colors',
        dragging ? 'border-primary bg-primary/10' : 'border-primary/25 bg-primary/5 hover:bg-primary/10',
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
        <Upload className="size-6 text-primary" />
      </div>
      <p className="text-base font-semibold">Arraste um CSV aqui ou clique para selecionar</p>
      <p className="text-[13px] text-muted-foreground">Até 32 MB · colunas separadas por vírgula</p>
      <Button asChild size="default" className="pointer-events-none mt-1">
        <span>Selecionar arquivo</span>
      </Button>
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </label>
  )
}
