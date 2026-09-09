import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { ApiError } from '@/lib/api-error'
import { segmentsApi } from '../api/segments.api'

export function useSegments() {
  return useQuery({
    queryKey: queryKeys.segments.all,
    queryFn: () => segmentsApi.list(),
    staleTime: 5 * 60_000,
  })
}

export function useCreateSegment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: segmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.segments.all })
      toast.success('Segmento criado')
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}

export function useUpdateSegment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Parameters<typeof segmentsApi.update>[1]) =>
      segmentsApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.segments.all })
      toast.success('Segmento atualizado')
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}
