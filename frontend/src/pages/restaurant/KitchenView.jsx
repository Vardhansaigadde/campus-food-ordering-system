import { useMemo } from 'react'
import { Bike, Building2, ChefHat, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi, useInterval } from '../../lib/useApi'
import { time } from '../../lib/format'
import { useLiveEvent } from '../../context/LiveContext'
import { EmptyState, ErrorBox, PageHeader, PageLoader, VegMark } from '../../components/ui'

const itemCount = (o) => o.items.reduce((n, i) => n + i.quantity, 0)
const isDelivery = (o) => Boolean(o.delivery && !o.delivery.missed)

/** Made-fresh dishes added up across orders: "8 × Fried Rice" with the orders they belong to. */
function addUp(orders) {
  const map = new Map()
  for (const o of orders) {
    for (const i of o.items.filter((x) => !x.readyMade)) {
      const g = map.get(i.dishId) ?? { name: i.name, veg: i.veg, quantity: 0, forDelivery: 0, orders: [] }
      g.quantity += i.quantity
      if (isDelivery(o)) g.forDelivery += i.quantity
      g.orders.push({ id: o.id, label: `${o.token}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`, delivery: isDelivery(o) })
      map.set(i.dishId, g)
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity)
}

/** Upcoming delivery runs: what to cook for each one, and which buildings it goes to. */
function runsAhead(orders) {
  const runs = new Map()
  for (const o of orders) {
    const run = runs.get(o.delivery.run) ?? { run: o.delivery.run, orders: [], places: new Set() }
    run.orders.push(o)
    run.places.add(o.delivery.location)
    runs.set(o.delivery.run, run)
  }
  return [...runs.values()]
    .sort((a, b) => new Date(a.run) - new Date(b.run))
    .map((r) => ({
      ...r,
      dishes: addUp(r.orders),
      readyMade: r.orders.reduce((n, o) => n + o.items.filter((i) => i.readyMade).reduce((m, i) => m + i.quantity, 0), 0),
    }))
}

/** What the cooks need to make: now (incl. deliveries leaving soon), per delivery run, and later pre-orders. */
export default function KitchenView() {
  const { data, loading, error, reload } = useApi(() => api.get('/restaurant/orders/active').then((r) => r.data), [])
  useLiveEvent(['NEW_ORDER', 'ORDER_BOOKED', 'ORDER_CANCELLED'], () => reload({ silent: true }))
  useInterval(() => reload({ silent: true }), 20_000)

  const { now, runs, later } = useMemo(() => {
    const soon = Date.now() + 30 * 60000
    const kitchen = (data ?? []).filter((o) => o.status === 'PLACED' || o.status === 'PREPARING')
    const due = (o) => !o.pickupTime || new Date(o.pickupTime).getTime() <= soon
    return {
      now: addUp(kitchen.filter(due)),
      runs: runsAhead(kitchen.filter((o) => !due(o) && isDelivery(o))),
      later: kitchen.filter((o) => !due(o) && !isDelivery(o)),
    }
  }, [data])

  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  return (
    <>
      <PageHeader title="Kitchen view" subtitle="Made-fresh dishes to cook, added up across all orders. Ready-made dishes are not listed." />

      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><ChefHat className="h-5 w-5 text-brand" /> Cook now</h2>
      {now.length === 0 ? (
        <EmptyState icon={ChefHat} title="Nothing to cook right now" text="New orders will appear here automatically." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {now.map((g) => (
            <div key={g.name} className="card p-5">
              <div className="flex items-center gap-4">
                <span className="text-5xl font-black tabular-nums text-brand">{g.quantity}</span>
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold"><VegMark veg={g.veg} /> {g.name}</h3>
                  <p className="text-xs text-muted">
                    {g.orders.length} order{g.orders.length > 1 ? 's' : ''}
                    {g.forDelivery > 0 && <> · <b className="text-violet-700 dark:text-violet-300">{g.forDelivery} for delivery</b></>}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {g.orders.map((o) =>
                  o.delivery ? (
                    <span key={o.id + o.label} className="chip bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      <Bike className="h-3 w-3" aria-hidden="true" /> {o.label} <span className="sr-only">delivery</span>
                    </span>
                  ) : (
                    <span key={o.id + o.label} className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{o.label}</span>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {runs.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-violet-700 dark:text-violet-300"><Bike className="h-5 w-5" /> Delivery runs</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {runs.map((r) => (
              <div key={r.run} className="card border-violet-200 p-5 dark:border-violet-500/30">
                <h3 className="font-display text-xl font-extrabold">{time(r.run)} run</h3>
                <p className="text-sm text-muted">
                  {r.orders.length} order{r.orders.length > 1 ? 's' : ''} · pack before {time(r.run)}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {r.dishes.map((d) => (
                    <li key={d.name} className="flex items-center gap-2 font-semibold">
                      <span className="w-9 text-right text-lg font-black tabular-nums text-brand">{d.quantity}×</span>
                      <VegMark veg={d.veg} /> {d.name}
                    </li>
                  ))}
                  {r.readyMade > 0 && <li className="pl-11 text-sm text-muted">+ {r.readyMade} ready-made plate{r.readyMade > 1 ? 's' : ''} to pack</li>}
                </ul>
                <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
                  <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {[...r.places].join(', ')}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {later.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-purple-600"><Clock className="h-5 w-5" /> Pre-orders for later ({later.length})</h2>
          <div className="flex flex-wrap gap-2">
            {later.map((o) => (
              <span key={o.id} className="chip bg-purple-100 px-3 py-1.5 text-sm text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                {o.token} · pickup {time(o.pickupTime)} · {itemCount(o)} item{itemCount(o) === 1 ? '' : 's'}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
