import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import toast from 'react-hot-toast'
import { unlockAudio } from '../lib/alerts'
import { enablePush, onPushChange, pushStatus } from '../lib/push'
import { Spinner } from './ui'

/**
 * "Turn on alerts" card, shown until this phone is registered for push.
 * Hidden where push can't work (old browsers, `npm run dev` without a service worker).
 */
export default function PushPrompt({ title, text }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const refresh = () => pushStatus().then((s) => alive && setStatus(s)).catch(() => {})
    refresh()
    const off = onPushChange(refresh)
    return () => {
      alive = false
      off()
    }
  }, [])

  if (status !== 'off' && status !== 'denied') return null

  const turnOn = async () => {
    unlockAudio()
    setBusy(true)
    try {
      const result = await enablePush()
      setStatus(result)
      if (result === 'on') toast.success('Alerts on – you will be notified even when the phone is locked')
      else if (result === 'denied') toast.error('Notifications are blocked. Allow them in your browser settings for this site.')
    } catch {
      toast.error('Could not turn on alerts. Check your internet and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-[20px] border border-brand-200 bg-brand-50 p-4 dark:border-brand-400/60 dark:bg-brand-500/10">
      <BellRing className="mt-0.5 h-6 w-6 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {status === 'denied' ? (
          <p className="mt-0.5 text-sm text-muted">
            Alerts are blocked on this phone. Open your browser's site settings for this app and allow notifications.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-sm text-muted">{text}</p>
            <button className="btn-primary mt-3 w-full sm:w-auto" disabled={busy} onClick={turnOn}>
              {busy && <Spinner className="h-4 w-4" />} Turn on alerts
            </button>
          </>
        )}
      </div>
    </div>
  )
}
