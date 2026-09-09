import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { suppressionApi } from '../api/suppression.api'

export function useSuppressions() {
  return useQuery({ queryKey: queryKeys.suppressions.all, queryFn: () => suppressionApi.list() })
}
