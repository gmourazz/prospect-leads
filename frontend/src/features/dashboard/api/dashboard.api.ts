import { http } from '@/lib/http'
import type { DashboardMetrics } from '@/types/domain'

export const dashboardApi = {
  overview: (days: number) => http.get<DashboardMetrics>(`/analytics/overview?days=${days}`),
}
