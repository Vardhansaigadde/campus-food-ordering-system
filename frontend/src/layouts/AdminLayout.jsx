import { Suspense, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { FileClock, KeyRound, LayoutDashboard, LogOut, Megaphone, Menu as MenuIcon, Moon, Receipt, Store, Sun, Users } from 'lucide-react'
import { Modal, PageLoader } from '../components/ui'
import Brand from '../components/Brand'
import HeaderTools from '../components/HeaderTools'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { ADMIN_BASE } from '../config'

const LINKS = [
  { to: 'dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard },
  { to: 'restaurants', label: 'Restaurants', short: 'Canteens', icon: Store },
  { to: 'orders', label: 'All Orders', short: 'Orders', icon: Receipt },
  { to: 'users', label: 'Users', short: 'Users', icon: Users },
  { to: 'announcements', label: 'Announcements', icon: Megaphone },
  { to: 'audit', label: 'Audit Log', icon: FileClock },
  { to: 'account', label: 'Change password', icon: KeyRound },
]
// Phones: the 4 most used pages in a bottom bar, the rest behind "More"
const PHONE_TABS = LINKS.filter((l) => l.short)
const PHONE_MORE = LINKS.filter((l) => !l.short)

function MoreSheet({ open, onClose }) {
  const { dark, toggle } = useTheme()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const row = 'flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-base font-semibold hover:bg-orange-100/70 dark:hover:bg-slate-800'
  return (
    <Modal open={open} onClose={onClose} title="More">
      <div className="space-y-1">
        {PHONE_MORE.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={`${ADMIN_BASE}/${to}`} onClick={onClose} className={row}>
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
            navigate(ADMIN_BASE, { replace: true })
          }}
        >
          <LogOut className="h-5 w-5" /> Log out
        </button>
      </div>
    </Modal>
  )
}

export default function AdminLayout() {
  const [moreOpen, setMoreOpen] = useState(false)
  return (
    <div className="min-h-screen pb-28 lg:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Brand to={`${ADMIN_BASE}/dashboard`} subtitle="Control panel" />
          <div className="ml-auto hidden lg:block">
            <HeaderTools logoutTo={ADMIN_BASE} />
          </div>
          <div className="ml-auto lg:hidden">
            <HeaderTools compact />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-5 lg:flex-row lg:py-6">
        <nav className="hidden shrink-0 gap-1 lg:flex lg:w-52 lg:flex-col">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={`${ADMIN_BASE}/${to}`}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold ${isActive ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Bottom tab bar on phones and tablets */}
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-5 rounded-[22px] border border-line bg-white/95 shadow-block backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden">
        {PHONE_TABS.map(({ to, short, icon: Icon }) => (
          <NavLink
            key={to}
            to={`${ADMIN_BASE}/${to}`}
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
