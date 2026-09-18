import { useEffect, useRef, useState } from 'react'

interface CountUpProps {
  to: number
  /** Text shown before the number, e.g. "+". */
  prefix?: string
  /** Text shown after the number, e.g. "h". */
  suffix?: string
  /** Pad the number with a leading zero (06 instead of 6). */
  pad?: boolean
  durationMs?: number
  delayMs?: number
}

export function CountUp({ to, prefix = '', suffix = '', pad = false, durationMs = 1100, delayMs = 0 }: CountUpProps) {
  const [value, setValue] = useState(0)
  const frame = useRef<number>()

  useEffect(() => {
    const start = performance.now() + delayMs
    const tick = (now: number) => {
      const elapsed = now - start
      if (elapsed < 0) {
        frame.current = requestAnimationFrame(tick)
        return
      }
      const t = Math.min(elapsed / durationMs, 1)
      // ease-out so the count decelerates into its final value
      setValue(Math.round(to * (1 - Math.pow(1 - t, 3))))
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [to, durationMs, delayMs])

  const shown = pad ? String(value).padStart(2, '0') : String(value)

  return (
    <span>
      {prefix}
      {shown}
      {suffix}
    </span>
  )
}
