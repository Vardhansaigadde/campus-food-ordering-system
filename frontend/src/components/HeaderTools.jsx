import { useState } from 'react'
import { Bell, BellOff, LogOut, Moon, Sun } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useLive } from '../context/LiveContext'
import { useAuth } from '../context/AuthContext'
import { notificationsSupported, requestNotificationPermission, unlockAudio } from '../lib/alerts'
import { enablePush, pushSupported } from '../lib/push'

/**
 * Live connection dot, alerts button, dark-mode switch and logout – shared by all layouts.
 * `compact` keeps only the dot and alerts button (phone headers; the rest lives in a menu).
 */
export default function HeaderTools({ logoutTo = '/login', compact = false }) {
  const { dark, toggle } = useTheme()
  const { connected } = useLive()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [permission, setPermission] = useState(() =>
    notificationsSupported() ? Notification.permission : 'unsupported',
  )

  const enableAlerts = async () => {
    unlockAudio()
    const result = await requestNotificationPermission()
    setPermission(result)
    if (result === 'granted') {
      const push = pushSupported() ? await enablePush().catch(() => 'off') : 'unsupported'
      toast.success(push === 'on' ? 'Alerts on – even when the phone is locked' : 'Alerts on – you will hear a chime when something changes')
    } else if (result === 'denied') toast.error('Notifications are blocked in your browser settings')
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
          onClick={enableAlerts}
          title={permission === 'granted' ? 'Alerts are on' : 'Turn on sound & notifications'}
          aria-label="Notification settings"
        >
          {permission === 'granted' ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5 text-brand" />}
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
