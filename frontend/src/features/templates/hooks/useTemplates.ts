import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { ApiError } from '@/lib/api-error'
import { templatesApi, type TemplateInput } from '../api/templates.api'

export function useTemplates() {
  return useQuery({ queryKey: queryKeys.templates.all, queryFn: () => templatesApi.list() })
}

export function useTemplateVariables() {
  return useQuery({
    queryKey: queryKeys.templates.variables,
    queryFn: () => templatesApi.variables(),
    staleTime: Infinity,
  })
}

export function useCreateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: TemplateInput) => templatesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
      toast.success('Template criado')
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}

/** A new version never rewrites the body already sent — it only becomes the
 * template's current version going forward. */
export function useNewTemplateVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & TemplateInput) => templatesApi.newVersion(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
      toast.success('Nova versão salva')
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => templatesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
      toast.success('Template removido')
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.userMessage : 'Algo deu errado.'),
  })
}
