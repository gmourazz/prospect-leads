import type { LeadFilters } from '@/types/domain'

export const queryKeys = {
  leads: {
    all: ['leads'] as const,
    list: (filters: LeadFilters) => ['leads', 'list', filters] as const,
    detail: (id: string) => ['leads', 'detail', id] as const,
    cities: ['leads', 'cities'] as const,
  },
  segments: { all: ['segments'] as const },
  templates: {
    all: ['templates'] as const,
    detail: (id: string) => ['templates', 'detail', id] as const,
    variables: ['templates', 'variables'] as const,
  },
  campaigns: {
    all: ['campaigns'] as const,
    detail: (id: string) => ['campaigns', 'detail', id] as const,
    targets: (id: string, state: string) => ['campaigns', id, 'targets', state] as const,
    batches: (id: string) => ['campaigns', id, 'batches'] as const,
  },
  contacts: {
    events: (id: string) => ['contacts', id, 'events'] as const,
  },
  imports: {
    all: ['imports'] as const,
    detail: (id: string) => ['imports', 'detail', id] as const,
  },
  suppressions: { all: ['suppressions'] as const },
  dashboard: { overview: (days: number) => ['dashboard', 'overview', days] as const },
} as const
