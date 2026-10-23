import { Suspense } from 'react'
import { PageLoader } from '../components/ui'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { Heart, Receipt, ShoppingBag, Store, UserRound, Wallet } from 'lucide-react'
import Brand from '../components/Brand'
import HeaderTools from '../components/HeaderTools'
import AnnouncementBar from '../components/AnnouncementBar'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'

const LINKS = [
  { to: '/restaurants', label: 'Restaurants', icon: Store },
  { to: '/orders', label: 'My Orders', icon: Receipt },
  { to: '/favourites', label: 'Favourites', icon: Heart },
  { to: '/spending', label: 'Spending', icon: Wallet },
]

export default function StudentLayout() {
  const { count } = useCart()
  const { user } = useAuth()

  return (
    <div className="min-h-screen pb-28 md:pb-0">
      <AnnouncementBar />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Brand to="/restaurants" subtitle={`Hi, ${user?.name?.split(' ')[0] ?? ''}`} />
          <nav className="ml-6 hidden gap-1 md:flex">
            {LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-semibold ${isActive ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link to="/cart" className="relative btn-ghost p-2" aria-label={`Cart, ${count} items`}>
              <ShoppingBag className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 border-2 border-white px-1 text-[11px] font-bold text-white dark:border-slate-900">
                  {count}
                </span>
              )}
            </Link>
            <Link to="/account" className="btn-ghost p-2" aria-label="My account" title="My account">
              <UserRound className="h-5 w-5" />
            </Link>
            {/* On phones these live on the Account page so the header never overflows */}
            <div className="hidden sm:block">
              <HeaderTools />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Bottom tab bar on phones */}
      <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-4 rounded-[22px] border border-line bg-white/95 shadow-block backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden">
        {LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${isActive ? 'text-brand' : 'text-muted'}`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
