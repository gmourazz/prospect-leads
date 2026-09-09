import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { ApiError } from '@/lib/api-error'
import type { LeadFilters } from '@/types/domain'
import { leadsApi } from '../api/leads.api'

export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: queryKeys.leads.list(filters),
    queryFn: ({ signal }) => leadsApi.list(filters, signal),
    placeholderData: (previous) => previous,
  })
}

export function useCities() {
  return useQuery({
    queryKey: queryKeys.leads.cities,
    queryFn: () => leadsApi.cities(),
    staleTime: 5 * 60_000,
  })
}

export function useContactEvents(contactPointId: string | null) {
  return useQuery({
    queryKey: queryKeys.contacts.events(contactPointId ?? ''),
    queryFn: () => leadsApi.contactEvents(contactPointId!),
    enabled: Boolean(contactPointId),
    staleTime: 60_000,
  })
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      leadsApi.updateStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Status atualizado')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => leadsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      toast.success('Lead removido', {
        description: 'O histórico de contato deste número foi preservado.',
      })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => leadsApi.create(body),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (lead.contact.contact_count > 0) {
        toast.warning('Lead criado — este número já foi contatado antes', {
          description: `${lead.contact.contact_count} contato(s) registrados no histórico.`,
        })
      } else {
        toast.success('Lead criado')
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useSuppressContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => leadsApi.suppress(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppressions.all })
      toast.success('Número bloqueado', {
        description: 'Ele não entrará em nenhum lote, mesmo em novas coletas.',
      })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useEnrichProgress() {
  return useQuery({
    queryKey: ['leads', 'enrich-progress'],
    queryFn: () => leadsApi.enrichProgress(),
    // Fast while it is working, idle otherwise: this is the only way the
    // user can tell a minutes-long background job is alive.
    refetchInterval: (query) => (query.state.data?.running ? 2000 : false),
  })
}

export function useEnrichEmails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (limit?: number) => leadsApi.enrichEmails(limit),
    onSuccess: (result) => {
      if (result.queued === 0) {
        toast.info('Todos os leads já têm email')
        return
      }
      toast.success(`Buscando email de ${result.queued} leads`, {
        description: 'Roda em segundo plano. Atualize a lista em alguns minutos.',
      })
      queryClient.invalidateQueries({ queryKey: ['leads', 'enrich-progress'] })
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useUpdateContactEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => leadsApi.updateEmail(id, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      toast.success('Email atualizado')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useUnsuppressContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => leadsApi.unsuppress(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.suppressions.all })
      toast.success('Bloqueio removido')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.userMessage : 'Algo deu errado.'
}
