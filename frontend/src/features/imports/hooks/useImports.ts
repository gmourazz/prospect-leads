import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { ApiError } from '@/lib/api-error'
import { importsApi } from '../api/imports.api'

export function useImports() {
  return useQuery({ queryKey: queryKeys.imports.all, queryFn: () => importsApi.list() })
}

export function useAnalyzeImport() {
  return useMutation({
    mutationFn: ({ file, segmentId }: { file: File; segmentId?: string }) =>
      importsApi.analyze(file, segmentId),
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}

export function useCommitImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, idempotencyKey }: { jobId: string; idempotencyKey: string }) =>
      importsApi.commit(jobId, idempotencyKey),
    onSuccess: (preview) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Importação concluída', {
        description: `${preview.will_create} novas, ${preview.will_merge} atualizadas, ${preview.already_contacted} já contatadas.`,
      })
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}
