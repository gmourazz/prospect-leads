import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import { ChevronsLeftRight } from 'lucide-react'

interface BeforeAfterCardProps {
  beforeSrc: string
  afterSrc: string
  beforeLabel: string
  afterLabel: string
  caption: string
}

export function BeforeAfterCard({ beforeSrc, afterSrc, beforeLabel, afterLabel, caption }: BeforeAfterCardProps) {
  const [percent, setPercent] = useState(50)
  const frameRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const updateFromClientX = useCallback((clientX: number) => {
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    const ratio = ((clientX - rect.left) / rect.width) * 100
    setPercent(Math.min(100, Math.max(0, ratio)))
  }, [])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromClientX(event.clientX)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    updateFromClientX(event.clientX)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <motion.div
      className="before-after-card"
      whileHover={{ scale: 1.015 }}
      transition={{ duration: 0.35, ease: [0.2, 0.7, 0.3, 1] }}
    >
      <div
        ref={frameRef}
        className="before-after-frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img className="before-after-img before-after-img-after" src={afterSrc} alt={`${caption} — depois`} draggable={false} />
        <div className="before-after-img-clip" style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}>
          <img className="before-after-img before-after-img-before" src={beforeSrc} alt={`${caption} — antes`} draggable={false} />
        </div>

        <div className="before-after-line" style={{ left: `${percent}%` }}>
          <span className="before-after-handle">
            <ChevronsLeftRight size={16} />
          </span>
        </div>

        <span className="before-after-tag before-after-tag-before">{beforeLabel.toUpperCase()}</span>
        <span className="before-after-tag before-after-tag-after">{afterLabel.toUpperCase()}</span>
      </div>
      <div className="before-after-caption">{caption}</div>
    </motion.div>
  )
}
