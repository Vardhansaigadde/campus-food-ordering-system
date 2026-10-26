import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { IdCard, X } from 'lucide-react'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useLiveEvent } from '../context/LiveContext'

const HIDE_KEY = 'cf-faculty-reminder-hidden'

/**
 * "Verify now" for people who said they're faculty but haven't sent their college ID yet
 * (or whose request was turned down). Until they're approved they simply order as students.
 */
export default function FacultyReminder() {
  const { pathname } = useLocation()
  // Re-read on every page change, so the reminder disappears right after they send the ID
  const { data: me, reload } = useApi(() => api.get('/auth/me').then((r) => r.data), [pathname])
  useLiveEvent(['FACULTY_APPROVED', 'FACULTY_REJECTED'], () => reload({ silent: true }))
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(HIDE_KEY) === '1'
    } catch {
      return false
    }
  })

  const status = me?.facultyStatus
  if (hidden || pathname === '/account' || (status !== 'NOT_VERIFIED' && status !== 'REJECTED')) return null

  const hide = () => {
    setHidden(true)
    try {
      sessionStorage.setItem(HIDE_KEY, '1')
    } catch {
      /* the banner simply comes back next time */
    }
  }

  return (
    <div className="mx-auto mt-3 max-w-6xl px-4">
      <div className="flex items-start gap-3 rounded-[20px] border border-brand-200 bg-brand-50 p-4 dark:border-brand-400/50 dark:bg-brand-500/10" role="status">
        <IdCard className="mt-0.5 h-6 w-6 shrink-0 text-brand" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {status === 'REJECTED' ? 'Your faculty request was not approved' : 'Verify that you are faculty'}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {status === 'REJECTED'
              ? `${me.facultyNote ? `${me.facultyNote}. ` : ''}Send your college ID again to get food delivered. Until then you order for pickup.`
              : 'Send a photo of your college ID to get food delivered to your room. Until then you order for pickup, like students.'}
          </p>
          <Link to="/account" state={{ faculty: true }} className="btn-primary mt-3">Verify now</Link>
        </div>
        <button className="btn-ghost -mr-2 -mt-2 shrink-0" onClick={hide} aria-label="Hide this reminder for now">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
