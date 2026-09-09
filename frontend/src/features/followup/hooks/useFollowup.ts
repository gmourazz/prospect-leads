import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api-error'
import { followupApi } from '../api/followup.api'

const KEY = (minDays: number) => ['awaiting-reply', minDays] as const

export function useAwaitingReply(minDays: number) {
  return useQuery({
    queryKey: KEY(minDays),
    queryFn: () => followupApi.list(minDays),
  })
}

export function usePrepareFollowup() {
  return useMutation({
    mutationFn: ({ leadId, templateVersionId }: { leadId: string; templateVersionId: string }) =>
      followupApi.prepare(leadId, templateVersionId),
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useConfirmFollowup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      dispatchId,
      ...body
    }: {
      dispatchId: string
      template_version_id: string
      rendered_body: string
      company_name: string
      template_name: string
    }) => followupApi.confirm(dispatchId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awaiting-reply'] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Follow-up registrado no histórico')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useCancelFollowup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dispatchId: string) => followupApi.cancel(dispatchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awaiting-reply'] })
      toast.info('Follow-up cancelado, o lead continua na lista')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

export function useMarkReplied() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ contactPointId, note }: { contactPointId: string; note?: string }) =>
      followupApi.markReplied(contactPointId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awaiting-reply'] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Marcado como respondeu')
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.userMessage : 'Algo deu errado.'
}
