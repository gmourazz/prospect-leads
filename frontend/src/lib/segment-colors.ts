// Segment color names are stored as short keywords (not hex) so the palette
// stays consistent everywhere a segment shows up — the badge, the table
// avatar, the chart bars — without each place inventing its own mapping.
export const SEGMENT_COLOR_HEX: Record<string, string> = {
  slate: '#64748b',
  amber: '#d97706',
  sky: '#0284c7',
  cyan: '#0891b2',
  lime: '#65a30d',
  violet: '#7c3aed',
  rose: '#e11d48',
  emerald: '#059669',
}

export function segmentColorHex(color: string | undefined): string {
  return SEGMENT_COLOR_HEX[color ?? ''] ?? SEGMENT_COLOR_HEX.slate
}

/** Tinted background for a segment's hex — the avatar circle and the
 * segment badge both read as "light background, solid-colored text/icon"
 * rather than a flat colored chip. */
export function segmentTint(color: string | undefined, alpha = 0.14): string {
  const hex = segmentColorHex(color).replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
