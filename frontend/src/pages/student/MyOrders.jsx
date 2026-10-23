import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Receipt, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi, useInterval } from '../../lib/useApi'
import { dateTime, money, time } from '../../lib/format'
import { useLiveEvent } from '../../context/LiveContext'
import { useCart } from '../../context/CartContext'
import { reorder } from '../../lib/reorder'
import { EmptyState, ErrorBox, PageHeader, PageLoader, StatusBadge } from '../../components/ui'

export default function MyOrders() {
  const [tab, setTab] = useState('active')
  const [page, setPage] = useState(0)
  const { data, loading, error, reload } = useApi(
    () => api.get('/orders/my', { params: { active: tab === 'active', page, size: 15 } }).then((r) => r.data),
    [tab, page],
  )
  useLiveEvent(null, (e) => e.type?.startsWith('ORDER_') && reload({ silent: true }))
  useInterval(() => tab === 'active' && reload({ silent: true }), 30_000)

  const cart = useCart()
  const navigate = useNavigate()

  const again = async (order) => {
    try {
      const { missing, added } = await reorder(order, cart)
      if (!added) return toast.error('None of these dishes are available today')
      if (missing) toast(`${missing} dish(es) are not available today and were skipped`, { icon: 'ℹ️' })
      navigate('/cart')
    } catch (e) {
      toast.error(e.message && !e.response ? e.message : errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="My orders" />
      <div className="mb-5 inline-flex rounded-full bg-slate-200/70 p-1 dark:bg-slate-800">
        {[
          ['active', 'Active'],
          ['past', 'Past orders'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key)
              setPage(0)
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-white shadow dark:bg-slate-900' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data.content.length ? (
        <EmptyState
          icon={Receipt}
          title={tab === 'active' ? 'No active orders' : 'No past orders yet'}
          action={<Link to="/restaurants" className="btn-primary">Order something</Link>}
        />
      ) : (
        <div className="space-y-3">
          {data.content.map((o) => (
            <div key={o.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <Link to={`/orders/${o.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex h-14 w-20 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
                  <span className="text-xs font-semibold uppercase text-brand">Order</span>
                  <span className="text-sm font-black text-brand-700 dark:text-brand-300">{o.token}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{o.restaurantName}</p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="truncate text-sm text-muted">
                    {o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </p>
                  <p className="text-xs text-muted">
                    {dateTime(o.createdAt)} · {money(o.total)}
                    {o.queuePosition ? ` · #${o.queuePosition} in queue, ~${o.etaMinutes} min` : ''}
                    {o.pickupTime ? ` · pickup ${time(o.pickupTime)}` : ''}
                  </p>
                </div>
                <ChevronRight className="hidden h-5 w-5 text-muted sm:block" />
              </Link>
              {tab === 'active' && o.otp && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-2 text-white dark:bg-white dark:text-slate-900 sm:flex-col sm:items-end sm:gap-0">
                  <span className="text-xs uppercase tracking-wide opacity-80">OTP</span>
                  <span className="font-mono text-xl font-black tracking-[0.3em]">{o.otp}</span>
                </div>
              )}
              {tab === 'past' && (
                <button className="btn-secondary shrink-0" onClick={() => again(o)}>
                  <RotateCcw className="h-4 w-4" /> Order again
                </button>
              )}
            </div>
          ))}
          {data.totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="btn-secondary" disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
