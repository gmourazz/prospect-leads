import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-error'
import { queryKeys } from '@/lib/query-keys'
import { sourcingApi } from '../api/sourcing.api'

export function useSearchLeads() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sourcingApi.search,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['searches', 'usage'] })
      queryClient.invalidateQueries({ queryKey: ['searches', 'recent'] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}

export function useRecentSearches() {
  return useQuery({
    queryKey: ['searches', 'recent'],
    queryFn: () => sourcingApi.recent(),
    staleTime: 30_000,
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

/** Kicks off a paced, background search across every city of a state. The
 * run itself is tracked by useStateSearchProgress — this only queues it. */
export function useSearchState() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sourcingApi.searchState,
    onSuccess: (result) => {
      toast.success(`Busca iniciada em ${result.queued} cidade(s)`, {
        description: 'Roda em segundo plano, no ritmo do provedor. Pode sair desta tela.',
      })
      queryClient.invalidateQueries({ queryKey: ['searches', 'state', 'progress'] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}

export function useStateSearchProgress() {
  return useQuery({
    queryKey: ['searches', 'state', 'progress'],
    queryFn: () => sourcingApi.stateSearchProgress(),
    // Fast while it runs, idle otherwise: same reasoning as email discovery —
    // it's the only way to tell a long background run apart from a stuck one.
    refetchInterval: (query) => (query.state.data?.running ? 2000 : false),
  })
}

export function useCancelStateSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sourcingApi.cancelStateSearch,
    onSuccess: () => {
      toast.info('Cancelando busca…', { description: 'Para assim que a cidade atual terminar.' })
      queryClient.invalidateQueries({ queryKey: ['searches', 'state', 'progress'] })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}
