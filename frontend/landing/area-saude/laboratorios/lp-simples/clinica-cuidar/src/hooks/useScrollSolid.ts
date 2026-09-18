import { useEffect, useState } from 'react'

export function useScrollSolid(threshold = 90): boolean {
  const [solid, setSolid] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0
      setSolid(y > threshold)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return solid
}
