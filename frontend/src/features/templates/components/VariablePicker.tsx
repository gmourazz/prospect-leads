import { useTemplateVariables } from '../hooks/useTemplates'
import { Badge } from '@/components/ui/badge'

export function VariablePicker({ onInsert }: { onInsert: (variable: string) => void }) {
  const { data } = useTemplateVariables()
  return (
    <div className="flex flex-wrap gap-1.5">
      {data?.data.map((v: string) => (
        <button key={v} type="button" onClick={() => onInsert(v)}>
          <Badge variant="outline" className="cursor-pointer transition-colors hover:bg-muted">
            {`{{${v}}}`}
          </Badge>
        </button>
      ))}
    </div>
  )
}
