import { useCallback, useState, type DragEvent } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
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
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors',
        dragging ? 'border-primary bg-muted/50' : 'border-border hover:bg-muted/30',
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-muted">
        {dragging ? <Upload className="size-5" /> : <FileSpreadsheet className="size-5 text-muted-foreground" />}
      </div>
      <p className="text-sm font-medium">Arraste um CSV aqui ou clique para selecionar</p>
      <p className="text-[12px] text-muted-foreground">
        Colunas de nome, telefone, cidade e site são detectadas automaticamente
      </p>
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
