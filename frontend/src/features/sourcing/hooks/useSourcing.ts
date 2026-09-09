import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { sourcingApi } from '../api/sourcing.api'

export function useSearchLeads() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sourcingApi.search,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['searches', 'usage'] }),
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}

/** Creates leads for exactly the checked rows — never the whole result set —
 * through the same dedupe/history path as CSV import. */
export function useImportSelected() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sourcingApi.importSelected,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const parts = [`${result.created} novos`]
      if (result.merged > 0) parts.push(`${result.merged} atualizados`)
      if (result.already_contacted > 0) parts.push(`${result.already_contacted} já contatados`)
      toast.success('Leads criados', { description: parts.join(', ') })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}

export function useSearchUsage() {
  return useQuery({
    queryKey: ['searches', 'usage'],
    queryFn: () => sourcingApi.usage(),
    staleTime: 30_000,
  })
}
