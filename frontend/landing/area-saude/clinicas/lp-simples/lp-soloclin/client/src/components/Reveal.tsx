import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

const EASE = [0.2, 0.7, 0.3, 1] as const

const container: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
}

export const revealItem: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
}

interface RevealProps {
  children: ReactNode
  className?: string
  /** Wrap direct children as staggered items (use for lists of cards/rows). */
  stagger?: boolean
}

export function Reveal({ children, className, stagger }: RevealProps) {
  if (!stagger) {
    return (
      <motion.div
        className={className}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-8% 0px -8% 0px' }}
        variants={revealItem}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-8% 0px -8% 0px' }}
      variants={container}
    >
      {children}
    </motion.div>
  )
}
