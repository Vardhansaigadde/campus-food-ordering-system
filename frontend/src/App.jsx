import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { homeFor, useAuth } from './context/AuthContext'
import { ADMIN_BASE } from './config'
import { PageLoader } from './components/ui'
import NotFound from './pages/NotFound'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

import StudentLayout from './layouts/StudentLayout'
import Restaurants from './pages/student/Restaurants'
import RestaurantMenu from './pages/student/RestaurantMenu'
import Cart from './pages/student/Cart'
import MyOrders from './pages/student/MyOrders'
import OrderDetail from './pages/student/OrderDetail'
import Favourites from './pages/student/Favourites'
import Account from './pages/student/Account'

import RestaurantLayout from './layouts/RestaurantLayout'
import LiveOrders from './pages/restaurant/LiveOrders'
import Today from './pages/restaurant/Today'
import KitchenView from './pages/restaurant/KitchenView'
import Menu from './pages/restaurant/Menu'
import Settings from './pages/restaurant/Settings'

// Pages with heavy libraries (charts, camera QR scanner) load only when opened.
const Spending = lazy(() => import('./pages/student/Spending'))
const VerifyPickup = lazy(() => import('./pages/restaurant/VerifyPickup'))
const Summary = lazy(() => import('./pages/restaurant/Summary'))

// The admin area is a separate code chunk that is only downloaded on the secret path.
const AdminLogin = lazy(() => import('./pages/auth/AdminLogin'))
const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminRestaurants = lazy(() => import('./pages/admin/Restaurants'))
const AdminRestaurantDishes = lazy(() => import('./pages/admin/RestaurantDishes'))
const AdminOrders = lazy(() => import('./pages/admin/Orders'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements'))
const AdminAudit = lazy(() => import('./pages/admin/Audit'))
const AdminAccount = lazy(() => import('./pages/admin/Account'))

/** Only lets the given role in. Students can never open restaurant pages and vice versa. */
function RequireRole({ role }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    // Nobody is told the admin area exists
    if (role === 'ADMIN') return <NotFound />
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (user.role !== role) {
    if (role === 'ADMIN') return <NotFound />
    return <Navigate to={homeFor(user, ADMIN_BASE)} replace />
  }
  return <Outlet />
}

function Home() {
  const { user } = useAuth()
  return <Navigate to={homeFor(user, ADMIN_BASE)} replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<RequireRole role="STUDENT" />}>
          <Route element={<StudentLayout />}>
            <Route path="/restaurants" element={<Restaurants />} />
            <Route path="/restaurants/:id" element={<RestaurantMenu />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/favourites" element={<Favourites />} />
            <Route path="/spending" element={<Spending />} />
            <Route path="/account" element={<Account />} />
          </Route>
        </Route>

        <Route element={<RequireRole role="RESTAURANT" />}>
          <Route path="/kitchen" element={<RestaurantLayout />}>
            <Route index element={<Today />} />
            <Route path="orders" element={<LiveOrders />} />
            <Route path="verify" element={<VerifyPickup />} />
            <Route path="prep" element={<KitchenView />} />
            <Route path="menu" element={<Menu />} />
            <Route path="summary" element={<Summary />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path={ADMIN_BASE} element={<AdminLogin />} />
        <Route element={<RequireRole role="ADMIN" />}>
          <Route element={<AdminLayout />}>
            <Route path={`${ADMIN_BASE}/dashboard`} element={<AdminDashboard />} />
            <Route path={`${ADMIN_BASE}/restaurants`} element={<AdminRestaurants />} />
            <Route path={`${ADMIN_BASE}/restaurants/:id`} element={<AdminRestaurantDishes />} />
            <Route path={`${ADMIN_BASE}/orders`} element={<AdminOrders />} />
            <Route path={`${ADMIN_BASE}/users`} element={<AdminUsers />} />
            <Route path={`${ADMIN_BASE}/announcements`} element={<AdminAnnouncements />} />
            <Route path={`${ADMIN_BASE}/audit`} element={<AdminAudit />} />
            <Route path={`${ADMIN_BASE}/account`} element={<AdminAccount />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
