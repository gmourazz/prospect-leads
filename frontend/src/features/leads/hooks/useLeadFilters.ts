import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { LeadFilters } from '@/types/domain'

const LAST_FILTERS_KEY = 'prospect_last_lead_filters'

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
  const restored = useRef(false)

  // Runs once per mount: if the URL arrived with no filters at all (a plain
  // nav to /leads, not a shared link), fall back to whatever this browser
  // last had applied instead of always starting blank.
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    if (searchParams.toString()) return
    try {
      const saved = localStorage.getItem(LAST_FILTERS_KEY)
      if (saved) setSearchParams(new URLSearchParams(saved), { replace: true })
    } catch {
      /* private browsing / storage disabled: just start blank */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LAST_FILTERS_KEY, searchParams.toString())
    } catch {
      /* ignore */
    }
  }, [searchParams])

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
