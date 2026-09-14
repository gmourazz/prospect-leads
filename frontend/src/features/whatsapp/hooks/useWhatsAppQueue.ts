import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-error'
import { SKIP_REASONS, whatsappApi } from '../api/whatsapp.api'

const KEY = ['whatsapp', 'queue'] as const

/** A fila anda sozinha no bridge local, então a tela precisa se atualizar
 *  sem interação — daí o refetch periódico em vez de invalidação manual. */
export function useWhatsAppQueue() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => whatsappApi.status(),
    refetchInterval: 10_000,
  })
}

export function useEnqueueWhatsApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ leadIds, templateVersionId }: { leadIds: string[]; templateVersionId: string }) =>
      whatsappApi.enqueue(leadIds, templateVersionId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: KEY })
      queryClient.invalidateQueries({ queryKey: ['leads'] })

      const skipped = Object.entries(result.skipped)
      if (result.queued === 0) {
        toast.error('Nenhum lead entrou na fila.')
      } else if (skipped.length > 0) {
        const detail = skipped
          .map(([reason, count]) => `${count} ${SKIP_REASONS[reason] ?? reason}`)
          .join(', ')
        toast.success(`${result.queued} na fila`, { description: `Fora: ${detail}.` })
      } else {
        toast.success(`${result.queued} lead(s) na fila do WhatsApp`)
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function usePauseWhatsApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (paused: boolean) => (paused ? whatsappApi.pause() : whatsappApi.resume()),
    onSuccess: (_data, paused) => {
      queryClient.invalidateQueries({ queryKey: KEY })
      toast.success(paused ? 'Fila pausada' : 'Fila liberada')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useClearWhatsAppQueue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => whatsappApi.clear(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: KEY })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success(`${result.canceled} mensagem(ns) removida(s) da fila`)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.userMessage : 'Algo deu errado.'
}
