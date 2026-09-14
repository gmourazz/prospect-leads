import { useState } from 'react'

export type Density = 'comfortable' | 'compact'

const STORAGE_KEY = 'prospect_leads_density'

export function useLeadDensity() {
  const [density, setDensity] = useState<Density>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Density) ?? 'comfortable'
    } catch {
      return 'comfortable'
    }
  })

  function change(next: Density) {
    setDensity(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private browsing / storage disabled: just won't persist */
    }
  }

  return [density, change] as const
}
