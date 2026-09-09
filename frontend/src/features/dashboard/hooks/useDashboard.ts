import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { dashboardApi } from '../api/dashboard.api'

export function useDashboard(days = 30) {
  return useQuery({
    queryKey: queryKeys.dashboard.overview(days),
    queryFn: () => dashboardApi.overview(days),
    staleTime: 30_000,
  })
}
