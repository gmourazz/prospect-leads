import { Inbox, SearchX } from 'lucide-react'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

export function LeadsEmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  if (filtered) {
    return (
      <EmptyState
        icon={SearchX}
        title="Nenhum lead corresponde a este filtro"
        description="Tente ampliar os filtros ou limpar a busca."
        action={<Button variant="secondary" size="sm" onClick={onClear}>Limpar filtros</Button>}
      />
    )
  }
  return (
    <EmptyState
      icon={Inbox}
      title="Nenhum lead ainda"
      description="Importe uma planilha ou cadastre um lead manualmente para começar."
      action={
        <Button asChild size="sm">
          <Link to="/importar">Importar CSV</Link>
        </Button>
      }
    />
  )
}
