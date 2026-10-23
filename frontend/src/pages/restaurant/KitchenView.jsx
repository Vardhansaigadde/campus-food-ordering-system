import { useMemo } from 'react'
import { ChefHat } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi, useInterval } from '../../lib/useApi'
import { time } from '../../lib/format'
import { useLiveEvent } from '../../context/LiveContext'
import { EmptyState, ErrorBox, PageHeader, PageLoader, VegMark } from '../../components/ui'

/** "8 × Veg Biryani pending" – what the cooks need to make right now, across all open orders. */
export default function KitchenView() {
  const { data, loading, error, reload } = useApi(() => api.get('/restaurant/orders/active').then((r) => r.data), [])
  useLiveEvent(['NEW_ORDER', 'ORDER_BOOKED', 'ORDER_CANCELLED'], () => reload({ silent: true }))
  useInterval(() => reload({ silent: true }), 20_000)

  const { now, later } = useMemo(() => {
    const soon = Date.now() + 30 * 60000
    const group = (orders) => {
      const map = new Map()
      for (const o of orders) {
        for (const i of o.items.filter((x) => !x.readyMade)) {
          const g = map.get(i.dishId) ?? { name: i.name, veg: i.veg, quantity: 0, tokens: [] }
          g.quantity += i.quantity
          g.tokens.push(`${o.token}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`)
          map.set(i.dishId, g)
        }
      }
      return [...map.values()].sort((a, b) => b.quantity - a.quantity)
    }
    const kitchen = (data ?? []).filter((o) => o.status === 'PLACED' || o.status === 'PREPARING')
    return {
      now: group(kitchen.filter((o) => !o.pickupTime || new Date(o.pickupTime).getTime() <= soon)),
      later: kitchen.filter((o) => o.pickupTime && new Date(o.pickupTime).getTime() > soon),
    }
  }, [data])

  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  return (
    <>
      <PageHeader title="Kitchen view" subtitle="Made-fresh dishes to cook now, added up across all orders. Ready-made dishes are not listed." />
      {now.length === 0 ? (
        <EmptyState icon={ChefHat} title="Nothing to cook right now" text="New orders will appear here automatically." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {now.map((g) => (
            <div key={g.name} className="card p-5">
              <div className="flex items-center gap-4">
                <span className="text-5xl font-black tabular-nums text-brand">{g.quantity}</span>
                <div>
                  <p className="flex items-center gap-2 text-lg font-bold"><VegMark veg={g.veg} /> {g.name}</p>
                  <p className="text-xs text-muted">{g.tokens.length} order{g.tokens.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {g.tokens.map((t) => (
                  <span key={t} className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {later.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-semibold text-purple-600">Pre-orders for later ({later.length})</h2>
          <div className="flex flex-wrap gap-2">
            {later.map((o) => (
              <span key={o.id} className="chip bg-purple-100 px-3 py-1.5 text-sm text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                {o.token} · {time(o.pickupTime)} · {o.items.reduce((n, i) => n + i.quantity, 0)} items
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
