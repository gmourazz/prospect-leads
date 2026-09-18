import { useEffect, useRef, useState } from 'react'
import { animate, useInView } from 'framer-motion'

interface CountUpProps {
  value: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}

const EASE = [0.2, 0.7, 0.3, 1] as const

export function CountUp({ value, prefix = '', suffix = '', duration = 1.4, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-10% 0px -10% 0px' })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    })
    return () => controls.stop()
  }, [inView, value, duration])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}
