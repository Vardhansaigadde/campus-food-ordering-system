import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banknote, Bike, Clock, MapPin, ShoppingBag, Store, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage, newIdempotencyKey } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { localDateTime, money, time } from '../../lib/format'
import { useCart } from '../../context/CartContext'
import { Stepper } from '../../components/DishCard'
import { EmptyState, PageHeader, Spinner, VegMark } from '../../components/ui'

/** Pickup slots for a pre-order: every 15 minutes from ~20 minutes from now until 10:45 PM. */
function pickupSlots() {
  const slots = []
  const d = new Date(Date.now() + 20 * 60000)
  d.setSeconds(0, 0)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15)
  const end = new Date()
  end.setHours(22, 45, 0, 0)
  while (d <= end && slots.length < 60) {
    slots.push(new Date(d))
    d.setMinutes(d.getMinutes() + 15)
  }
  return slots
}

/** "12:45:00" or "12:45" from the server -> today's Date at that time. */
function todayAt(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}

/** Delivery runs still open for orders (each closes `cutoffMinutes` before it leaves). */
function openRuns(delivery) {
  const now = Date.now()
  return (delivery?.runs ?? [])
    .map((r) => r.slice(0, 5))
    .filter((r) => todayAt(r).getTime() - delivery.cutoffMinutes * 60000 > now)
}

/**
 * Faculty delivery for this cart: who may order it, which buildings and runs the canteen offers.
 * Returns null for everyone else (students just see pickup).
 */
function useDeliveryOptions(restaurantId) {
  const { data } = useApi(async () => {
    if (!restaurantId) return null
    const [me, menu] = await Promise.all([
      api.get('/auth/me').then((r) => r.data),
      api.get(`/restaurants/${restaurantId}`).then((r) => r.data),
    ])
    const preorders = Boolean(menu.restaurant.preordersEnabled)
    const delivery = menu.restaurant.delivery
    if (me.facultyStatus !== 'APPROVED' || !delivery?.enabled) return { me, preorders, available: false }
    const places = (await api.get('/locations')).data
    const locations = places.filter((p) => delivery.locationIds.includes(p.id))
    return { me, preorders, available: locations.length > 0, delivery, locations, runs: openRuns(delivery) }
  }, [restaurantId])
  return data
}

export default function Cart() {
  const cart = useCart()
  const navigate = useNavigate()
  const [when, setWhen] = useState('now')
  const [note, setNote] = useState('')
  const [placing, setPlacing] = useState(false)
  const slots = useMemo(() => pickupSlots(), [])
  const options = useDeliveryOptions(cart.cart?.restaurantId)
  const [mode, setMode] = useState('pickup')
  const [place, setPlace] = useState(null)

  // Start from the faculty member's saved building and room, and the next open run
  const canDeliver = Boolean(options?.available)
  if (canDeliver && place === null) {
    const saved = options.locations.some((l) => l.id === options.me.deliveryLocationId)
    setPlace({
      locationId: String(saved ? options.me.deliveryLocationId : options.locations[0].id),
      room: options.me.deliveryRoom ?? '',
      run: options.runs[0] ?? '',
    })
    if (options.runs.length) setMode('delivery')
  }
  // When today's last delivery stopped taking orders, e.g. "11:45"
  const lastClose = canDeliver && options.delivery.runs.length
    ? (() => {
        const last = options.delivery.runs.map((r) => r.slice(0, 5)).sort().at(-1)
        return new Date(todayAt(last).getTime() - options.delivery.cutoffMinutes * 60000)
      })()
    : null
  const delivering = canDeliver && mode === 'delivery' && place !== null
  const fee = delivering ? Number(options.delivery.fee) : 0
  const minOrder = delivering && options.delivery.minOrder ? Number(options.delivery.minOrder) : 0
  const belowMin = delivering && cart.total < minOrder
  const grandTotal = cart.total + fee
  // Pre-ordering only when the canteen accepts it (unknown while loading = hidden)
  const preorders = Boolean(options?.preorders)
  if (!preorders && when !== 'now') setWhen('now')

  // Same key for retries of the same checkout => the server never creates a duplicate order.
  // A new key is made only when the cart, pickup time, delivery or note changes.
  const cartSignature = JSON.stringify(cart.lines.map((l) => [l.dish.id, l.quantity])) + when + note + mode + JSON.stringify(place)
  const idempotencyKey = useMemo(() => newIdempotencyKey(), [cartSignature]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!cart.lines.length) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        text="Choose a restaurant and add some dishes."
        action={<Link to="/restaurants" className="btn-primary">Browse restaurants</Link>}
      />
    )
  }

  const placeOrder = async () => {
    setPlacing(true)
    try {
      const { data } = await api.post(
        '/orders',
        {
          restaurantId: cart.cart.restaurantId,
          items: cart.lines.map((l) => ({ dishId: l.dish.id, quantity: l.quantity })),
          pickupTime: delivering || when === 'now' ? null : localDateTime(new Date(when)),
          note: note.trim() || null,
          delivery: delivering ? { locationId: Number(place.locationId), room: place.room.trim(), run: place.run } : null,
        },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
      cart.clear()
      toast.success(`Order placed! Your Order ID is ${data.token}`)
      navigate(`/orders/${data.id}`, { replace: true, state: { justPlaced: true } })
    } catch (e) {
      toast.error(errorMessage(e), { duration: 6000 })
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Your cart" subtitle={`${delivering ? 'Delivery' : 'Pickup'} from ${cart.cart.restaurantName}`} />

      <div className="card divide-y divide-slate-100 dark:divide-slate-800">
        {cart.lines.map(({ dish, quantity }) => (
          // Two lines on phones so the full dish name always shows (it used to be cut off: "Veg Noo…")
          <div key={dish.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1"><VegMark veg={dish.veg} /></span>
              <p className="min-w-0 flex-1 font-semibold leading-snug">{dish.name}</p>
              <span className="font-bold tabular-nums">{money(dish.price * quantity)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 pl-7">
              <span className="text-sm text-muted">{money(dish.price)} each</span>
              <Stepper
                value={quantity}
                onChange={(q) => cart.setQuantity(dish, { id: cart.cart.restaurantId, name: cart.cart.restaurantName }, q)}
              />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between p-4">
          <button className="btn-ghost px-2 text-red-600" onClick={cart.clear}>
            <Trash2 className="h-4 w-4" /> Clear cart
          </button>
          <Link to={`/restaurants/${cart.cart.restaurantId}`} className="text-sm font-semibold text-brand hover:underline">
            + Add more items
          </Link>
        </div>
      </div>

      {canDeliver && place && (
        <div className="card mt-4 space-y-4 p-4">
          <div>
            <p className="label">How do you want it?</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Pickup or delivery">
              {[
                { key: 'pickup', Icon: Store, title: 'Pickup', text: 'Collect at the counter' },
                { key: 'delivery', Icon: Bike, title: 'Delivery', text: 'To your room (faculty)' },
              ].map(({ key, Icon, title, text }) => {
                const closed = key === 'delivery' && !options.runs.length
                return (
                  <button
                    key={key}
                    role="radio"
                    aria-checked={mode === key}
                    disabled={closed}
                    onClick={() => setMode(key)}
                    className={`rounded-2xl border-2 p-3 text-left disabled:opacity-60 ${mode === key ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-700'}`}
                  >
                    <p className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-brand" /> {title}</p>
                    <p className="text-xs text-muted">{closed ? 'Closed for today' : text}</p>
                  </button>
                )
              })}
            </div>
            {!options.runs.length && lastClose && (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                Deliveries closed for today (last orders {time(lastClose)}).
              </p>
            )}
          </div>
          {delivering && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="label flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Building</span>
                  <select className="input" value={place.locationId} onChange={(e) => setPlace({ ...place, locationId: e.target.value })}>
                    {options.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Room</span>
                  <input className="input" maxLength={30} placeholder="e.g. 204 or Staff room" value={place.room} onChange={(e) => setPlace({ ...place, room: e.target.value })} />
                </label>
              </div>
              <div>
                <p className="label flex items-center gap-2"><Clock className="h-4 w-4" /> Delivery time</p>
                {options.runs.length ? (
                  <div className="flex flex-wrap gap-2">
                    {options.runs.map((r) => (
                      <button
                        key={r}
                        onClick={() => setPlace({ ...place, run: r })}
                        aria-pressed={place.run === r}
                        className={`min-h-11 rounded-full border-2 px-4 font-semibold ${place.run === r ? 'border-brand-500 bg-brand-50 text-brand dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-700'}`}
                      >
                        {time(todayAt(r))}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-amber-700 dark:text-amber-400">No more deliveries today – choose pickup instead.</p>
                )}
                <p className="mt-1.5 text-xs text-muted">Orders close {options.delivery.cutoffMinutes} minutes before each delivery.</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="card mt-4 space-y-4 p-4">
        {/* Only canteens that accept pre-orders get the "when" question; otherwise it's always as soon as possible */}
        {!delivering && preorders && <div>
          <p className="label flex items-center gap-2"><Clock className="h-4 w-4" /> When do you want to pick up?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => setWhen('now')}
              className={`rounded-2xl border-2 p-3 text-left ${when === 'now' ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-700'}`}
            >
              <p className="font-semibold">As soon as possible</p>
              <p className="text-xs text-muted">You'll get a live queue position</p>
            </button>
            <div className={`rounded-2xl border-2 p-3 ${when !== 'now' ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
              <p className="font-semibold">Pre-order for later today</p>
              <select
                className="input mt-1 py-1.5"
                value={when === 'now' ? '' : when}
                onChange={(e) => setWhen(e.target.value || 'now')}
                aria-label="Pickup time"
              >
                <option value="">Choose a time…</option>
                {slots.map((s) => (
                  <option key={s.toISOString()} value={s.toISOString()}>{time(s)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>}
        <div>
          <label className="label" htmlFor="note">Note for the kitchen <span className="font-normal text-muted">(optional)</span></label>
          <input id="note" className="input" maxLength={150} placeholder="e.g. less spicy, no onion" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="card mt-4 p-4">
        {delivering && (
          <div className="mb-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted">Food</span><span className="tabular-nums">{money(cart.total)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Delivery fee</span><span className="tabular-nums">{fee ? money(fee) : 'Free'}</span></div>
          </div>
        )}
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span className="tabular-nums">{money(grandTotal)}</span>
        </div>
        {belowMin && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            Minimum order for delivery is {money(minOrder)} – add {money(minOrder - cart.total)} more, or choose pickup.
          </p>
        )}
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Banknote className="h-4 w-4 shrink-0" />
          {delivering ? 'Pay in cash to the delivery person.' : 'Pay at the counter when you collect.'}
        </p>
        <button
          className="btn-primary mt-4 w-full py-3.5 text-base"
          onClick={placeOrder}
          disabled={placing || (delivering && (!place.run || !place.room.trim() || belowMin))}
        >
          {placing ? <Spinner className="h-5 w-5" /> : null}
          {placing ? 'Placing order…' : `Place order · ${money(grandTotal)}`}
        </button>
      </div>
    </div>
  )
}
