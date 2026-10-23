import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Banknote, Clock, ShoppingBag, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage, newIdempotencyKey } from '../../lib/api'
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

export default function Cart() {
  const cart = useCart()
  const navigate = useNavigate()
  const [when, setWhen] = useState('now')
  const [note, setNote] = useState('')
  const [placing, setPlacing] = useState(false)
  const slots = useMemo(() => pickupSlots(), [])

  // Same key for retries of the same checkout => the server never creates a duplicate order.
  // A new key is made only when the cart, pickup time or note changes.
  const cartSignature = JSON.stringify(cart.lines.map((l) => [l.dish.id, l.quantity])) + when + note
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
          pickupTime: when === 'now' ? null : localDateTime(new Date(when)),
          note: note.trim() || null,
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
      <PageHeader title="Your cart" subtitle={`Pickup from ${cart.cart.restaurantName}`} />

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

      <div className="card mt-4 space-y-4 p-4">
        <div>
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
        </div>
        <div>
          <label className="label" htmlFor="note">Note for the kitchen <span className="font-normal text-muted">(optional)</span></label>
          <input id="note" className="input" maxLength={150} placeholder="e.g. less spicy, no onion" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="card mt-4 p-4">
        <div className="flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span className="tabular-nums">{money(cart.total)}</span>
        </div>
        <p className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Banknote className="h-4 w-4 shrink-0" /> Pay at the counter when you collect. Pickup only – no room delivery.
        </p>
        <button className="btn-primary mt-4 w-full py-3.5 text-base" onClick={placeOrder} disabled={placing}>
          {placing ? <Spinner className="h-5 w-5" /> : null}
          {placing ? 'Placing order…' : `Place order · ${money(cart.total)}`}
        </button>
        <p className="mt-2 text-center text-xs text-muted">Final prices are confirmed by the restaurant when you order.</p>
      </div>
    </div>
  )
}
