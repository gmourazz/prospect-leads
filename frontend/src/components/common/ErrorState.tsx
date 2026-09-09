import { AlertTriangle } from 'lucide-react'
import { ApiError } from '@/lib/api-error'
import { Button } from '@/components/ui/button'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.userMessage : 'Não foi possível carregar.'
  const requestId = error instanceof ApiError ? error.requestId : undefined

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-danger-subtle">
        <AlertTriangle className="size-5 text-danger" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{message}</p>
        {requestId && (
          <p className="font-mono text-[11px] text-muted-foreground">{requestId}</p>
        )}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}
