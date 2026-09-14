const dateTime = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const dateOnly = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })

export function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return dateTime.format(new Date(value))
}

export function formatDate(value?: string | null) {
  if (!value) return '—'
  return dateOnly.format(new Date(value))
}

export function formatShortDate(value: string) {
  return shortDate.format(new Date(value))
}

export function formatRelative(value?: string | null) {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `há ${days} d`
  return formatDate(value)
}

const timeOnly = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** "hoje, 14:32" / "ontem, 21:14" / "2 dias atrás" — reads like someone
 * describing when they last did something, which is what a history list is. */
export function formatDayRelative(value: string) {
  const date = new Date(value)
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const days = Math.floor((startOfToday.getTime() - date.getTime()) / 86_400_000) + 1

  if (days <= 0) return `hoje, ${timeOnly.format(date)}`
  if (days === 1) return `ontem, ${timeOnly.format(date)}`
  if (days < 30) return `${days} dias atrás`
  return formatDate(value)
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(1).replace('.', ',')}%`
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function pluralize(count: number, one: string, many: string) {
  return count === 1 ? one : many
}
