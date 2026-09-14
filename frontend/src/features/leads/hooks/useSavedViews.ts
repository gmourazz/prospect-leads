import { useCallback, useState } from 'react'

const STORAGE_KEY = 'prospect_saved_lead_views'

export interface SavedView {
  name: string
  search: string
}

function read(): SavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedView[]) : []
  } catch {
    return []
  }
}

function write(views: SavedView[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  } catch {
    /* private browsing / storage disabled: views just won't persist */
  }
}

/** Filter combinations saved per-browser, not per-account — there is no
 * backend concept of a "view" yet, so this is a local shortcut list, not
 * shared state. */
export function useSavedViews() {
  const [views, setViews] = useState<SavedView[]>(() => read())

  const save = useCallback((name: string, search: string) => {
    setViews((previous) => {
      const next = [...previous.filter((v) => v.name !== name), { name, search }]
      write(next)
      return next
    })
  }, [])

  const remove = useCallback((name: string) => {
    setViews((previous) => {
      const next = previous.filter((v) => v.name !== name)
      write(next)
      return next
    })
  }, [])

  return { views, save, remove }
}
