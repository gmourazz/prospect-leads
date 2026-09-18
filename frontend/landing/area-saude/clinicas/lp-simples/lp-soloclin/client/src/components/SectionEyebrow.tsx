import type { ReactNode } from 'react'

interface SectionEyebrowProps {
  children: ReactNode
  tone?: 'green' | 'white'
}

export function SectionEyebrow({ children, tone = 'green' }: SectionEyebrowProps) {
  return <div className={`eyebrow eyebrow-${tone}`}>{children}</div>
}
