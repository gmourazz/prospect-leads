import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { LeadFilters } from '@/types/domain'

const KEYS = [
  'segment_id',
  'city',
  'state',
  'status',
  'website_status',
  'contact_state',
  'q',
  'sort',
  'page',
  'open_now',
  'has_email',
  'limit',
] as const

/**
 * Filters live in the URL, not in React state. Sharing a link reproduces the
 * screen, the back button works, and F5 keeps the context.
 */
export function useLeadFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo<LeadFilters>(() => {
    const result: LeadFilters = { limit: 50 }
    KEYS.forEach((key) => {
      const value = searchParams.get(key)
      if (value) {
        if (key === 'page') result.page = Number(value)
        else if (key === 'limit') result.limit = Number(value)
        else (result as Record<string, unknown>)[key] = value
      }
    })
    return result
  }, [searchParams])

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (!value) next.delete(key)
          else next.set(key, value)
          if (key !== 'page') next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const reset = useCallback(() => setSearchParams({}, { replace: true }), [setSearchParams])

  const activeCount = KEYS.filter(
    (key) => key !== 'page' && key !== 'sort' && key !== 'limit' && searchParams.get(key),
  ).length

  return { filters, setFilter, reset, activeCount, searchParams }
}
