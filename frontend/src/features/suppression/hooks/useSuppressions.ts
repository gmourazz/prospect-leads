import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { ApiError } from '@/lib/api-error'
import { suppressionApi } from '../api/suppression.api'

export function useSuppressions() {
  return useQuery({ queryKey: queryKeys.suppressions.all, queryFn: () => suppressionApi.list() })
}

export function useBlockPhone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ phone, reason }: { phone: string; reason?: string }) =>
      suppressionApi.block(phone, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppressions.all })
      toast.success('Número bloqueado')
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}
