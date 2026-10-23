import { useState } from 'react'
import { Megaphone, X } from 'lucide-react'
import { api } from '../lib/api'
import { useApi } from '../lib/useApi'
import { useLiveEvent } from '../context/LiveContext'

const STYLE = {
  INFO: 'bg-sky-600',
  WARNING: 'bg-amber-500',
  SUCCESS: 'bg-emerald-600',
}

function dismissedIds() {
  try {
    return JSON.parse(sessionStorage.getItem('cf-dismissed') ?? '[]')
  } catch {
    return []
  }
}

/** Admin announcements, e.g. "All canteens closed on Friday". Updates live. */
export default function AnnouncementBar() {
  const { data, reload } = useApi(() => api.get('/announcements/active').then((r) => r.data), [])
  const [dismissed, setDismissed] = useState(dismissedIds)
  useLiveEvent(['ANNOUNCEMENT', 'ANNOUNCEMENT_REMOVED'], () => reload({ silent: true }))

  const visible = (data ?? []).filter((a) => !dismissed.includes(a.id))
  if (!visible.length) return null

  const dismiss = (id) => {
    const next = [...dismissed, id]
    setDismissed(next)
    try {
      sessionStorage.setItem('cf-dismissed', JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      {visible.map((a) => (
        <div key={a.id} className={`${STYLE[a.level] ?? STYLE.INFO} text-white`}>
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
            <Megaphone className="h-4 w-4 shrink-0" />
            <p className="flex-1 font-medium">{a.message}</p>
            <button onClick={() => dismiss(a.id)} className="rounded p-1 hover:bg-white/20" aria-label="Dismiss announcement">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
