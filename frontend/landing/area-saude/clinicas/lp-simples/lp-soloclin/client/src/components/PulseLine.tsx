interface PulseLineProps {
  className?: string
}

/** Signature graphic motif — echoes the pulse line in the real Sólonclin sign. */
export function PulseLine({ className }: PulseLineProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 40"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 22 H62 L74 6 L90 36 L102 14 L112 22 H140 L150 10 L160 22 H220"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
