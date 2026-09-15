import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { interestedApi } from '../api/interested.api'

export function useInterested() {
  return useQuery({ queryKey: queryKeys.interested.all, queryFn: () => interestedApi.list() })
}
