import { useRef, useCallback } from 'react'

/**
 * The key is created at the CLICK, not at render. A key born during render
 * would be regenerated on every remount and the protection would evaporate;
 * this one survives retries and is only discarded after a confirmed success.
 */
export function useIdempotencyKey() {
  const keyRef = useRef<string | null>(null)

  const acquire = useCallback(() => {
    if (!keyRef.current) keyRef.current = crypto.randomUUID()
    return keyRef.current
  }, [])

  const release = useCallback(() => {
    keyRef.current = null
  }, [])

  return { acquire, release }
}
