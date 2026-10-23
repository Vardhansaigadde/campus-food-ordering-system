import { useEffect, useState } from 'react'
import { Bell, BellOff, LogOut, Moon, Sun } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useLive } from '../context/LiveContext'
import { useAuth } from '../context/AuthContext'
import { alertsMuted, notificationsSupported, requestNotificationPermission, setAlertsMuted, unlockAudio } from '../lib/alerts'
import { enablePush, onPushChange, pushSupported, turnOffAlerts } from '../lib/push'

/**
 * Live connection dot, alerts button, dark-mode switch and logout – shared by all layouts.
 * `compact` keeps only the dot and alerts button (phone headers; the rest lives in a menu).
 */
export default function HeaderTools({ logoutTo = '/login', compact = false }) {
  const { dark, toggle } = useTheme()
  const { connected } = useLive()
  const { logout, token } = useAuth()
  const navigate = useNavigate()
  const [permission, setPermission] = useState(() =>
    notificationsSupported() ? Notification.permission : 'unsupported',
  )

  const [muted, setMuted] = useState(alertsMuted)
  // The "turn on alerts" card elsewhere can switch alerts on too – keep the bell in step
  useEffect(() => {
    const off = onPushChange(() => setMuted(alertsMuted()))
    return () => {
      off()
    }
  }, [])
  const on = permission === 'granted' && !muted

  const enableAlerts = async () => {
    unlockAudio()
    setAlertsMuted(false)
    setMuted(false)
    const result = await requestNotificationPermission()
    setPermission(result)
    if (result === 'granted') {
      const push = pushSupported() ? await enablePush().catch(() => 'off') : 'unsupported'
      toast.success(push === 'on' ? 'Alerts on – even when the phone is locked' : 'Alerts on – you will hear a chime when something changes')
    } else if (result === 'denied') toast.error('Notifications are blocked in your browser settings')
  }

  const disableAlerts = async () => {
    setMuted(true)
    await turnOffAlerts(token).catch(() => {})
    toast('Alerts off on this phone – tap the bell to turn them on again')
  }

  return (
    <div className="flex items-center gap-1">
      <span
        title={connected ? 'Live updates connected' : 'Reconnecting live updates…'}
        className={`mr-1 h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'animate-pulse bg-amber-400'}`}
      />
      {permission !== 'unsupported' && (
        <button
          className="btn-ghost p-2"
          onClick={on ? disableAlerts : enableAlerts}
          title={on ? 'Alerts are on – tap to turn off' : 'Alerts are off – tap to turn on'}
          aria-label="Alerts"
          aria-pressed={on}
        >
          {on ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5 text-brand" />}
        </button>
      )}
      {!compact && (
        <>
          <button className="btn-ghost p-2" onClick={toggle} aria-label="Toggle dark mode" title="Dark mode">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            className="btn-ghost p-2"
            aria-label="Log out"
            title="Log out"
            onClick={() => {
              logout()
              navigate(logoutTo, { replace: true })
            }}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  )
}
