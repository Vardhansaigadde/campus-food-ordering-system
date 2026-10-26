import { Suspense, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BarChart3, Bike, ChefHat, ChevronDown, ClipboardList, ListChecks, LogOut, Menu as MenuIcon, Moon, Settings, ShieldCheck, Sun, UtensilsCrossed } from 'lucide-react'
import toast from 'react-hot-toast'
import Brand from '../components/Brand'
import HeaderTools from '../components/HeaderTools'
import AnnouncementBar from '../components/AnnouncementBar'
import { Modal, PageLoader } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { useApi } from '../lib/useApi'
import { time } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useWakeLock } from '../lib/useWakeLock'
import { useHandoverSync, withSnapshot } from '../lib/offline'

const LINKS = [
  { to: '/kitchen', label: 'Today', short: 'Today', icon: UtensilsCrossed, end: true },
  { to: '/kitchen/orders', label: 'Orders', short: 'Orders', icon: ClipboardList },
  { to: '/kitchen/verify', label: 'Scan & hand over', short: 'Scan', icon: ShieldCheck },
  { to: '/kitchen/menu', label: 'Menu', short: 'Menu', icon: ListChecks },
  { to: '/kitchen/deliveries', label: 'Deliveries', icon: Bike },
  { to: '/kitchen/summary', label: 'Day summary', icon: BarChart3 },
  { to: '/kitchen/prep', label: 'Kitchen View', icon: ChefHat },
  { to: '/kitchen/settings', label: 'Settings', icon: Settings },
]
// Phones get a bottom bar with the 4 screens used during service; the rest sit behind "More"
const PHONE_TABS = LINKS.filter((l) => l.short)
const PHONE_MORE = LINKS.filter((l) => !l.short)

const STATUS_BTN = {
  OPEN: 'bg-emerald-700 text-white',
  BUSY: 'bg-amber-400 text-ink',
  CLOSED: 'bg-slate-700 text-white',
}
const STATUS_LABEL = { OPEN: 'Open', BUSY: 'Busy', CLOSED: 'Closed' }
const BUSY_MINUTES = [10, 15, 30, 45, 60, 90]

/**
 * Open / Busy / Closed switch – always visible to restaurant staff.
 * Wide screens: a 3-way switch. Phones: one pill that opens a sheet, so a stray tap can't close the shop.
 */
function StatusSwitch() {
  const { data: profile, setData } = useApi(() => withSnapshot('profile', () => api.get('/restaurant/profile').then((r) => r.data), () => {}), [])
  const [sheet, setSheet] = useState(null) // null | 'busy' (wide screens) | 'all' (phones)
  const [saving, setSaving] = useState(false)

  const change = async (status, busyMinutes) => {
    setSaving(true)
    try {
      const { data } = await api.patch('/restaurant/status', { status, busyMinutes })
      setData(data)
      toast.success(status === 'BUSY' ? `Paused new orders for ${busyMinutes} min` : `Restaurant is now ${status.toLowerCase()}`)
      setSheet(null)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return null
  const until = profile.status === 'BUSY' && profile.busyUntil ? time(profile.busyUntil) : null
  return (
    <>
      <div className="hidden items-center gap-1 rounded-xl bg-slate-100 p-1 sm:flex dark:bg-slate-800" role="group" aria-label="Restaurant status">
        {['OPEN', 'BUSY', 'CLOSED'].map((s) => (
          <button
            key={s}
            disabled={saving}
            onClick={() => (s === 'BUSY' ? setSheet('busy') : change(s))}
            className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-bold transition ${profile.status === s ? STATUS_BTN[s] : 'text-muted hover:bg-white dark:hover:bg-slate-700'}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {until && <span className="hidden text-xs text-amber-600 lg:inline">until {until}</span>}

      <button
        onClick={() => setSheet('all')}
        className={`flex min-h-11 items-center gap-1 rounded-full px-4 text-sm font-bold sm:hidden ${STATUS_BTN[profile.status]}`}
        aria-label={`Restaurant is ${STATUS_LABEL[profile.status]}. Change status`}
      >
        {STATUS_LABEL[profile.status]}
        {until && <span className="text-xs font-semibold">· {until}</span>}
        <ChevronDown className="h-4 w-4" />
      </button>

      <Modal open={!!sheet} onClose={() => setSheet(null)} title={sheet === 'all' ? 'Restaurant status' : 'Pause new orders'}>
        {sheet === 'all' && (
          <div className="mb-5 grid grid-cols-2 gap-2">
            <button className={`btn min-h-14 text-base ${profile.status === 'OPEN' ? STATUS_BTN.OPEN : 'btn-secondary'}`} disabled={saving} onClick={() => change('OPEN')}>
              Open
            </button>
            <button className={`btn min-h-14 text-base ${profile.status === 'CLOSED' ? STATUS_BTN.CLOSED : 'btn-secondary'}`} disabled={saving} onClick={() => change('CLOSED')}>
              Closed
            </button>
          </div>
        )}
        {sheet === 'all' && <h3 className="mb-1 font-semibold">Too busy? Pause new orders for…</h3>}
        <p className="mb-4 text-sm text-muted">
          New orders pause, then it opens again by itself.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {BUSY_MINUTES.map((m) => (
            <button key={m} className="btn-secondary" disabled={saving} onClick={() => change('BUSY', m)}>
              {m} min
            </button>
          ))}
        </div>
      </Modal>
    </>
  )
}

/** Phone-only sheet: the less used screens plus dark mode and logout. */
function MoreSheet({ open, onClose }) {
  const { dark, toggle } = useTheme()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const row = 'flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-base font-semibold hover:bg-orange-100/70 dark:hover:bg-slate-800'
  return (
    <Modal open={open} onClose={onClose} title="More">
      <div className="space-y-1">
        {PHONE_MORE.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={onClose} className={row}>
            <Icon className="h-5 w-5 text-brand" /> {label}
          </NavLink>
        ))}
        <button className={row} onClick={toggle}>
          {dark ? <Sun className="h-5 w-5 text-brand" /> : <Moon className="h-5 w-5 text-brand" />} {dark ? 'Light mode' : 'Dark mode'}
        </button>
        <button
          className={`${row} text-red-600 dark:text-red-400`}
          onClick={() => {
            logout()
            navigate('/login', { replace: true })
          }}
        >
          <LogOut className="h-5 w-5" /> Log out
        </button>
      </div>
    </Modal>
  )
}

export default function RestaurantLayout() {
  const [moreOpen, setMoreOpen] = useState(false)
  // The counter phone must not lock in the middle of the rush
  useWakeLock()
  // Handovers typed without internet are confirmed as soon as it is back
  useHandoverSync()
  return (
    <div className="min-h-screen pb-28 md:pb-0">
      <AnnouncementBar />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
          <div className="hidden sm:block">
            <Brand to="/kitchen" subtitle="Restaurant dashboard" />
          </div>
          <div className="sm:hidden">
            <Brand to="/kitchen" />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <StatusSwitch />
            <div className="hidden md:block">
              <HeaderTools />
            </div>
            <div className="md:hidden">
              <HeaderTools compact />
            </div>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:flex">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 min-h-11 rounded-full px-4 py-2 text-sm font-semibold ${isActive ? 'bg-brand-500 text-white' : 'text-slate-700 hover:bg-orange-100/70 dark:text-slate-300 dark:hover:bg-slate-800'}`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Bottom tab bar on phones – within thumb reach */}
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-5 rounded-[22px] border border-line bg-white/95 shadow-block backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
        {PHONE_TABS.map(({ to, short, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-brand' : 'text-muted'}`
            }
          >
            <Icon className="h-5 w-5" />
            {short}
          </NavLink>
        ))}
        <button onClick={() => setMoreOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-muted">
          <MenuIcon className="h-5 w-5" />
          More
        </button>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  )
}
