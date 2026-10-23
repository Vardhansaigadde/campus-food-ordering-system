import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Star, Store, UtensilsCrossed, X } from 'lucide-react'
import { STATUS_LABEL } from '../lib/format'

export function Spinner({ className = '' }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />
}

export function PageLoader() {
  return (
    <div className="flex justify-center py-20 text-brand">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-4" onClick={() => onRetry()}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-5 rounded-full bg-brand-50 p-5 text-brand dark:bg-slate-800 dark:text-brand-400">
          <Icon className="h-8 w-8" />
        </div>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const STATUS_STYLE = {
  PLACED: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  PREPARING: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  READY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  COLLECTED: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
  CANCELLED: 'bg-slate-100 text-muted dark:bg-slate-800 dark:text-slate-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  NO_SHOW: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
}

export function StatusBadge({ status }) {
  return <span className={`chip ${STATUS_STYLE[status] ?? ''}`}>{STATUS_LABEL[status] ?? status}</span>
}

const RESTAURANT_STYLE = {
  OPEN: ['bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', 'Open'],
  BUSY: ['bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', 'Busy'],
  CLOSED: ['bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300', 'Closed'],
}

export function RestaurantStatusBadge({ status }) {
  const [cls, label] = RESTAURANT_STYLE[status] ?? RESTAURANT_STYLE.CLOSED
  return (
    <span className={`chip ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'OPEN' ? 'bg-emerald-500' : status === 'BUSY' ? 'bg-amber-500' : 'bg-slate-400'}`} />
      {label}
    </span>
  )
}

/** Indian veg / non-veg symbol. */
export function VegMark({ veg }) {
  return (
    <span
      title={veg ? 'Vegetarian' : 'Non-vegetarian'}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-2 ${veg ? 'border-emerald-600' : 'border-red-600'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${veg ? 'bg-emerald-600' : 'bg-red-600'}`} />
    </span>
  )
}

export function Rating({ value, count }) {
  if (!value) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
      <Star className="h-3.5 w-3.5 fill-current" />
      {value.toFixed(1)}
      {count ? <span className="font-normal text-muted">({count})</span> : null}
    </span>
  )
}

export function StarInput({ value, onChange, size = 'h-7 w-7' }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(n)}
          className="text-amber-400 transition hover:scale-110"
        >
          <Star className={`${size} ${n <= value ? 'fill-current' : 'text-slate-300 dark:text-slate-600'}`} />
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  // Portal to <body>: a Modal opened from the sticky header would otherwise be trapped inside it,
  // because the header's backdrop-blur makes it the containing block for `position: fixed`
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card max-h-[92vh] w-full animate-pop overflow-y-auto rounded-b-none p-5 sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-ghost -mr-2 p-2" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'brand', className = '' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand dark:bg-brand-500/10',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    blue: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  }
  return (
    <div className={`card flex items-center gap-3 p-3 sm:gap-4 sm:p-4 ${className}`}>
      {Icon && (
        <div className={`rounded-xl p-2 sm:p-3 ${tones[tone]}`}>
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs leading-tight text-muted sm:text-sm">{label}</p>
        <p className="truncate text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  )
}

/** Photo, or an icon placeholder for dishes / restaurants without one (no emoji – design system rule). */
export function FoodImage({ src, alt, className = '', kind = 'dish' }) {
  if (src) {
    return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} onError={(e) => (e.currentTarget.style.display = 'none')} />
  }
  const Icon = kind === 'restaurant' ? Store : UtensilsCrossed
  return (
    <div aria-hidden="true" className={`flex items-center justify-center bg-[#f3ece4] text-[#a8998a] [background-image:radial-gradient(#e8ded2_1.5px,transparent_1.5px)] [background-size:14px_14px] dark:bg-slate-800 dark:text-brand-400 dark:[background-image:radial-gradient(#334155_1.5px,transparent_1.5px)] ${className}`}>
      <Icon className="h-1/3 max-h-12 w-1/3 max-w-12" strokeWidth={2} />
    </div>
  )
}
