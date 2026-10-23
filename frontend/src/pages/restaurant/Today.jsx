import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChefHat, Minus, PackageCheck, Pencil, Plus, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi, useInterval } from '../../lib/useApi'
import { money, time } from '../../lib/format'
import { useLiveEvent } from '../../context/LiveContext'
import { EmptyState, ErrorBox, Modal, PageLoader, Spinner, VegMark } from '../../components/ui'
import PushPrompt from '../../components/PushPrompt'
import { withSnapshot } from '../../lib/offline'

const LIVE_EVENTS = ['ORDER_BOOKED', 'NEW_ORDER', 'ORDER_CANCELLED', 'ORDER_COLLECTED', 'ORDER_NO_SHOW', 'STOCK_LOW', 'SOLD_OUT']

/** "How many plates are left?" sheet – tap the big number to open it. */
function QuantitySheet({ dish, onClose, onSaved }) {
  const [value, setValue] = useState(dish.stockLeft ?? '')
  const [saving, setSaving] = useState(false)

  const save = async (stockLeft) => {
    setSaving(true)
    try {
      const { data } = await api.patch(`/restaurant/menu/dishes/${dish.id}/stock`, { stockLeft })
      onSaved(data)
      toast.success(stockLeft == null ? `${dish.name}: no limit` : `${dish.name}: ${stockLeft} plates left`)
      onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const n = value === '' ? 0 : Number(value)
  return (
    <Modal open onClose={onClose} title={`Plates for app orders – ${dish.name}`}>
      <p className="mb-4 text-sm text-muted">How many plates can students still order in the app? Keep your walk-in plates aside and don't count them here – e.g. cooked 60, keep 10 for walk-ins, enter 50.</p>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-secondary h-14 w-14 text-xl" aria-label="One less" onClick={() => setValue(Math.max(0, n - 1))}>
          <Minus className="h-5 w-5" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={1000}
          aria-label="Plates left"
          className="input h-14 flex-1 text-center text-3xl font-black"
          value={value}
          onChange={(e) => setValue(e.target.value === '' ? '' : Math.min(1000, Math.max(0, Number(e.target.value))))}
        />
        <button type="button" className="btn-secondary h-14 w-14 text-xl" aria-label="One more" onClick={() => setValue(Math.min(1000, n + 1))}>
          <Plus className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[5, 10, 20].map((k) => (
          <button key={k} type="button" className="btn-secondary" onClick={() => setValue(Math.min(1000, n + k))}>+{k}</button>
        ))}
      </div>
      <button className="btn-primary mt-5 w-full py-3 text-base" disabled={saving || value === ''} onClick={() => save(n)}>
        {saving && <Spinner className="h-4 w-4" />} Save {value === '' ? '' : `${n} plates`}
      </button>
      <button className="btn-ghost mt-2 w-full" disabled={saving} onClick={() => save(null)}>No limit (made fresh / plenty)</button>
    </Modal>
  )
}

/**
 * One dish. The big number = plates students can still order in the app. Walk-ins are served from the
 * plates the owner keeps aside, so they need no tap – only when those run out he taps "−1 walk-in".
 */
function DishCard({ dish, busy, onSell, onEdit }) {
  const limited = dish.stockLeft != null
  const soldOut = limited && dish.stockLeft === 0
  const low = limited && dish.stockLeft > 0 && dish.stockLeft <= 5
  return (
    <div className={`card p-4 ${soldOut ? 'border-red-300 dark:border-red-500/40' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-lg font-bold leading-tight">
            <VegMark veg={dish.veg} /> <span>{dish.name}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {money(dish.price)} · {dish.readyMade ? 'Ready-made' : 'Made fresh'}
          </p>
        </div>
        {soldOut && <span className="chip shrink-0 bg-red-600 text-white">Sold out</span>}
        {low && <span className="chip shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Running low</span>}
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        <button
          onClick={() => onEdit(dish)}
          className={`col-span-3 flex min-h-20 flex-col items-center justify-center rounded-3xl border-2 py-2 ${soldOut ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10' : 'border-line bg-cream dark:border-slate-700 dark:bg-slate-800'}`}
          aria-label={`Plates left for app orders of ${dish.name}: ${limited ? dish.stockLeft : 'no limit'}. Change`}
        >
          <span className={`text-4xl font-black tabular-nums leading-none ${soldOut ? 'text-red-600' : low ? 'text-amber-600' : ''}`}>
            {limited ? dish.stockLeft : '∞'}
          </span>
          <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted">
            <Pencil className="h-3 w-3" /> {limited ? 'left for app orders' : 'no limit'}
          </span>
        </button>
        {soldOut ? (
          <button className="btn-primary col-span-2 h-full flex-col gap-0 rounded-3xl text-sm leading-tight" onClick={() => onEdit(dish)}>
            <Plus className="h-5 w-5" /> Cooked more?
          </button>
        ) : (
          <button className="btn-secondary col-span-2 h-full flex-col gap-0 rounded-3xl leading-tight" disabled={busy} onClick={() => onSell(dish)}>
            {busy ? <Spinner className="h-5 w-5" /> : <span className="text-lg font-black">−1</span>}
            <span className="text-xs font-semibold">walk-in</span>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * The owner's main screen during service: today's quantities, walk-in sales, and what's waiting.
 * Built for a busy cook: big numbers, one tap per walk-in plate, nothing to accept.
 */
export default function Today() {
  const [offlineAt, setOfflineAt] = useState(null)
  const dishes = useApi(() => withSnapshot('today-dishes', () => api.get('/restaurant/menu/dishes').then((r) => r.data), setOfflineAt), [])
  const orders = useApi(() => withSnapshot('active-orders', () => api.get('/restaurant/orders/active').then((r) => r.data), () => {}), [])
  const walkIn = useApi(() => api.get('/restaurant/menu/counter-sales/summary').then((r) => r.data), [])
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const refresh = () => {
    dishes.reload({ silent: true })
    orders.reload({ silent: true })
  }
  useLiveEvent(LIVE_EVENTS, refresh)
  useInterval(refresh, 30_000)

  const replace = (dish) => dishes.setData((list) => list.map((d) => (d.id === dish.id ? { ...d, ...dish } : d)))

  const undo = async (saleId, name) => {
    try {
      const { data } = await api.delete(`/restaurant/menu/counter-sales/${saleId}`)
      if (data) replace(data)
      walkIn.reload({ silent: true })
      toast.success(`Undone – ${name} back in stock`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const sell = async (dish) => {
    setBusyId(dish.id)
    try {
      const { data } = await api.post(`/restaurant/menu/dishes/${dish.id}/counter-sale`, { quantity: 1 })
      replace(data.dish)
      walkIn.reload({ silent: true })
      navigator.vibrate?.(40)
      toast(
        (t) => (
          <span className="flex items-center gap-3">
            <span>Sold 1 {dish.name}</span>
            <button
              className="rounded-lg bg-slate-900 px-3 py-1 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
              onClick={() => {
                toast.dismiss(t.id)
                undo(data.saleId, dish.name)
              }}
            >
              Undo
            </button>
          </span>
        ),
        { duration: 5000, id: `sale-${dish.id}` },
      )
    } catch (e) {
      toast.error(errorMessage(e))
      refresh()
    } finally {
      setBusyId(null)
    }
  }

  if (dishes.loading) return <PageLoader />
  if (dishes.error) return <ErrorBox message={dishes.error} onRetry={dishes.reload} />

  // Batch-cooked dishes (the biryani) first – that's where the counting happens
  const today = dishes.data.filter((d) => d.onTodayMenu).sort((a, b) => Number(b.readyMade) - Number(a.readyMade))
  const active = orders.data ?? []
  const toCollect = active.filter((o) => o.status === 'READY').length
  const toCook = active.filter((o) => o.status === 'PLACED' || o.status === 'PREPARING').length

  return (
    <div className="mx-auto max-w-3xl">
      {offlineAt && (
        <div role="status" className="mb-4 rounded-[20px] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-bold">No internet – showing the numbers from {time(new Date(offlineAt))}</p>
          <p className="mt-0.5">Changes can't be saved until the internet is back. Handovers typed on Scan are kept and confirmed later.</p>
        </div>
      )}
      <PushPrompt
        title="Turn on alerts on this phone"
        text="Get a buzz when something needs cooking, or when a dish is running out – even with the phone locked."
      />

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Link to="/kitchen/orders" className="card flex flex-col items-center p-3 text-center">
          <PackageCheck className="h-5 w-5 text-emerald-600" />
          <span className="text-2xl font-black tabular-nums">{toCollect}</span>
          <span className="text-xs leading-tight text-muted">to collect</span>
        </Link>
        <Link to="/kitchen/orders" className="card flex flex-col items-center p-3 text-center">
          <ChefHat className="h-5 w-5 text-amber-600" />
          <span className="text-2xl font-black tabular-nums">{toCook}</span>
          <span className="text-xs leading-tight text-muted">to cook</span>
        </Link>
        <div className="card flex flex-col items-center p-3 text-center">
          <ShoppingBag className="h-5 w-5 text-sky-600" />
          <span className="text-2xl font-black tabular-nums">{walkIn.data?.plates ?? 0}</span>
          <span className="text-xs leading-tight text-muted">walk-in plates{walkIn.data?.amount ? ` · ${money(walkIn.data.amount)}` : ''}</span>
        </div>
      </div>

      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Today's food</h1>
          <p className="text-sm text-muted">The big number is what app students can still order. Serve walk-ins from the plates you keep aside – tap −1 only if you give them one of the app plates.</p>
        </div>
      </div>

      {today.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Nothing on today's menu yet"
          text="Switch on the dishes you're selling today. Students only see those."
          action={<Link to="/kitchen/menu" className="btn-primary">Set today's menu</Link>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {today.map((d) => (
            <DishCard key={d.id} dish={d} busy={busyId === d.id} onSell={sell} onEdit={setEditing} />
          ))}
        </div>
      )}

      {editing && <QuantitySheet dish={editing} onClose={() => setEditing(null)} onSaved={replace} />}
    </div>
  )
}
