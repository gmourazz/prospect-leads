import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { ApiError } from '@/lib/api-error'
import { campaignsApi } from '../api/campaigns.api'

export function useCampaigns() {
  return useQuery({ queryKey: queryKeys.campaigns.all, queryFn: () => campaignsApi.list() })
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: queryKeys.campaigns.detail(id),
    queryFn: () => campaignsApi.get(id),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.status === 'active' ? 5000 : false),
  })
}

export function useCampaignTargets(id: string, state: string) {
  return useQuery({
    queryKey: queryKeys.campaigns.targets(id, state),
    queryFn: () => campaignsApi.targets(id, state),
    enabled: Boolean(id),
  })
}

export function useCampaignBatches(id: string, range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: queryKeys.campaigns.batches(id, range?.from, range?.to),
    queryFn: () => campaignsApi.batches(id, range),
    enabled: Boolean(id),
  })
}

export function useSetCampaignStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'paused' | 'completed' }) =>
      campaignsApi.setStatus(id, status),
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.id) })
      const message =
        campaign.status === 'paused' ? 'Campanha pausada'
        : campaign.status === 'completed' ? 'Campanha marcada como concluída'
        : 'Campanha retomada'
      toast.success(message)
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => campaignsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all })
      toast.success('Campanha removida', {
        description: 'O histórico do que já foi enviado foi preservado.',
      })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}

export function useCreateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: campaignsApi.create,
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all })
      toast.success('Campanha criada', {
        description: `${campaign.progress.pending} de ${campaign.progress.total_targets} contatos disponíveis para envio.`,
      })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'no_eligible_targets') {
        toast.warning('Nenhum contato disponível para este filtro')
      } else {
        toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.')
      }
    },
  })
}

/**
 * Sends AT MOST `size` messages and stops. There is no loop here: sending the
 * next batch requires calling this hook again from an explicit click.
 */
export function useSendBatch(campaignId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      size,
      idempotencyKey,
      mode,
      approvalIds,
    }: {
      size: number
      idempotencyKey: string
      mode?: 'recontact'
      approvalIds?: string[]
    }) => campaignsApi.sendBatch(campaignId, { size, mode, approval_ids: approvalIds }, idempotencyKey),
    onSuccess: (outcome) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaignId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.batches(campaignId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })

      const { sent_count, failed_count } = outcome.batch
      if (failed_count === 0) {
        toast.success(`${sent_count} mensagem${sent_count === 1 ? '' : 's'} enviada${sent_count === 1 ? '' : 's'}`)
      } else if (sent_count === 0) {
        toast.error('Não foi possível enviar este lote', {
          description: 'Nenhuma mensagem duplicada foi enviada. Os contatos continuam disponíveis.',
        })
      } else {
        toast.warning(`${sent_count} enviadas, ${failed_count} falharam`, {
          description: 'As que falharam continuam disponíveis para nova tentativa.',
        })
      }
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}
