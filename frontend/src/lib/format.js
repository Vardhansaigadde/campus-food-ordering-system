const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

export const money = (value) => rupee.format(Number(value ?? 0)).replace('.00', '')

export function time(value) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function dateTime(value) {
  if (!value) return ''
  const d = new Date(value)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  return sameDay
    ? `Today, ${time(value)}`
    : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function date(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function minutesAgo(value) {
  if (!value) return ''
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.floor(mins / 60)
  return `${h} h ${mins % 60} min ago`
}

/** yyyy-MM-dd in local time (for date inputs and API params). */
export function isoDate(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local date-time string without timezone, e.g. 2026-10-07T12:30:00 – what the backend expects. */
export function localDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

export const STATUS_LABEL = {
  PLACED: 'Placed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  COLLECTED: 'Collected',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  NO_SHOW: 'No-show',
}
