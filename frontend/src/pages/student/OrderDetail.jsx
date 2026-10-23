import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Banknote, CheckCircle2, ChefHat, Clock, PartyPopper, QrCode, Receipt, ShieldAlert, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi, useInterval } from '../../lib/useApi'
import { dateTime, money, time } from '../../lib/format'
import { useLiveEvent } from '../../context/LiveContext'
import { ErrorBox, Modal, PageLoader, StarInput, StatusBadge, VegMark, Spinner } from '../../components/ui'
import PushPrompt from '../../components/PushPrompt'

const STEPS = [
  { key: 'PLACED', label: 'Placed', icon: Receipt },
  { key: 'PREPARING', label: 'Preparing', icon: ChefHat },
  { key: 'READY', label: 'Ready', icon: Store },
  { key: 'COLLECTED', label: 'Collected', icon: CheckCircle2 },
]

function Timeline({ status }) {
  const index = STEPS.findIndex((s) => s.key === status)
  return (
    <ol className="flex items-center">
      {STEPS.map((s, i) => {
        const done = i <= index
        const current = i === index
        return (
          <li key={s.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full ${done ? 'bg-brand-500 text-white' : 'bg-slate-200 text-muted dark:bg-slate-700'} ${current && status !== 'COLLECTED' ? 'animate-pulse-ring' : ''}`}
              >
                <s.icon className="h-5 w-5" />
              </span>
              <span className={`text-xs font-medium ${done ? 'text-slate-800 dark:text-slate-100' : 'text-muted'}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <span className={`mx-1 mb-5 h-1 flex-1 rounded ${i < index ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const location = useLocation()
  const { data: order, setData, loading, error, reload } = useApi(() => api.get(`/orders/${id}`).then((r) => r.data), [id])
  const [showQr, setShowQr] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Live: refresh the moment the restaurant changes this order; slow poll as a safety net (queue position)
  useLiveEvent(null, (e) => {
    if (String(e.data?.orderId) === String(id) || e.type === 'ORDER_READY') reload({ silent: true })
  })
  useInterval(() => {
    if (order && ['PLACED', 'PREPARING', 'READY'].includes(order.status)) reload({ silent: true })
  }, 20_000)

  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const active = ['PLACED', 'PREPARING', 'READY'].includes(order.status)
  const ready = order.status === 'READY'

  const cancel = async () => {
    if (!confirm('Cancel this order?')) return
    setCancelling(true)
    try {
      const { data } = await api.post(`/orders/${order.id}/cancel`)
      setData(data)
      toast.success('Order cancelled')
    } catch (e) {
      toast.error(errorMessage(e))
      reload({ silent: true })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> My orders
      </Link>

      {active && !ready && (
        <PushPrompt title="Get an alert when your food is ready" text="We'll notify you even if you close the app or lock your phone." />
      )}

      {location.state?.justPlaced && active && (
        <div className="flex animate-pop items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <PartyPopper className="h-6 w-6 shrink-0" />
          <p className="text-sm font-medium">Order placed! Keep this screen handy – you need the Order ID and OTP at the counter.</p>
        </div>
      )}

      {/* Pickup pass */}
      {active ? (
        <div className={`blocky animate-rise overflow-hidden ${ready ? 'border-emerald-600 ring-4 ring-emerald-600/15' : ''}`}>
          <div className={`border-b-2 px-5 py-3 text-center text-sm font-bold uppercase tracking-wider ${ready ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-transparent bg-brand-500 text-white'}`}>
            {ready
              ? order.pickupTime && new Date(order.pickupTime) > new Date()
                ? `Confirmed – collect from ${time(order.pickupTime)}`
                : 'Ready – go to the counter now'
              : 'Your pickup pass'}
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">
            <div className="p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Order ID</p>
              <p className="mt-1 whitespace-nowrap font-display text-3xl font-extrabold tracking-tight sm:text-5xl">{order.token}</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">OTP</p>
              <div className="mt-1 flex justify-center gap-1.5" aria-label={`OTP ${order.otp.split('').join(' ')}`}>
                {order.otp.split('').map((digit, i) => (
                  <span key={i} className="flex h-14 w-11 items-center justify-center rounded-2xl border border-line-strong bg-cream font-display text-3xl font-extrabold text-ink dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                    {digit}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <button className="btn-secondary w-full" onClick={() => setShowQr((v) => !v)}>
              <QrCode className="h-4 w-4" /> {showQr ? 'Hide QR code' : 'Show QR code for quick pickup'}
            </button>
            {showQr && (
              <div className="mt-4 flex flex-col items-center">
                <div className="rounded-2xl bg-white p-4">
                  <QRCodeSVG value={order.qrCode} size={200} level="M" />
                </div>
                <p className="mt-2 text-xs text-muted">Staff can scan this instead of typing the OTP</p>
              </div>
            )}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              <ShieldAlert className="h-3.5 w-3.5" /> Don't share your OTP – whoever has it can collect this order.
            </p>
          </div>
        </div>
      ) : (
        <div className="card p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Order</p>
          <p className="text-3xl font-black">{order.token}</p>
          <div className="mt-2"><StatusBadge status={order.status} /></div>
          {order.rejectReason && <p className="mt-3 text-sm text-red-600">Reason: {order.rejectReason}</p>}
          {order.status === 'NO_SHOW' && (
            <p className="mt-3 text-sm text-red-600">
              This order was not collected within {order.holdMinutes ? `${order.holdMinutes} minutes` : '3 hours'}, so the food went back on sale. 3 no-shows pause ordering for 7 days.
            </p>
          )}
        </div>
      )}

      {/* Progress + queue */}
      {['PLACED', 'PREPARING', 'READY', 'COLLECTED'].includes(order.status) && (
        <div className="card space-y-5 p-5">
          <Timeline status={order.status} />
          {order.queuePosition && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                <p className="text-3xl font-black text-brand">#{order.queuePosition}</p>
                <p className="text-xs text-muted">in the kitchen queue</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-800">
                <p className="text-3xl font-black text-brand">~{order.etaMinutes} min</p>
                <p className="text-xs text-muted">{order.pickupTime ? `pickup at ${time(order.pickupTime)}` : 'estimated ready time'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details */}
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{order.restaurantName}</h2>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <Clock className="h-4 w-4" /> Ordered {dateTime(order.createdAt)}
          {order.pickupTime && <> · Pickup at <b className="text-slate-700 dark:text-slate-200">{time(order.pickupTime)}</b></>}
        </p>
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {order.items.map((i) => (
            <li key={i.dishId} className="flex items-center gap-3 py-2.5 text-sm">
              <VegMark veg={i.veg} />
              <span className="flex-1">{i.quantity} × {i.name}</span>
              <span className="tabular-nums">{money(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {order.note && <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">Note: {order.note}</p>}
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-lg font-bold dark:border-slate-800">
          <span>Total</span>
          <span>{money(order.total)}</span>
        </div>
        {active && (
          <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Banknote className="h-4 w-4" /> Pay {money(order.total)} in cash at the counter
          </p>
        )}
        {ready && order.holdMinutes && (
          <p className="mt-1 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Clock className="h-4 w-4" /> Kept for you for {order.holdMinutes} minutes{order.pickupTime ? ' after pickup time' : ''} – after that it goes back on sale
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {order.cancellable && (
            <button className="btn-secondary text-red-600" onClick={cancel} disabled={cancelling}>
              {cancelling && <Spinner className="h-4 w-4" />} Cancel order
            </button>
          )}
          {order.status === 'COLLECTED' && !order.rating && (
            <button className="btn-primary" onClick={() => setRateOpen(true)}>Rate this order</button>
          )}
          {order.rating && <p className="text-sm text-muted">You rated this order {'★'.repeat(order.rating)}</p>}
        </div>
      </div>

      <RateModal open={rateOpen} order={order} onClose={() => setRateOpen(false)} onDone={(o) => setData(o)} />
    </div>
  )
}

function RateModal({ open, order, onClose, onDone }) {
  const [rating, setRating] = useState(0)
  const [dishStars, setDishStars] = useState({})
  const [review, setReview] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const { data } = await api.post(`/orders/${order.id}/rate`, {
        rating,
        review: review.trim() || null,
        dishes: Object.entries(dishStars).map(([dishId, stars]) => ({ dishId: Number(dishId), stars })),
      })
      onDone(data)
      onClose()
      toast.success('Thanks for your feedback!')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="How was your food?">
      <div className="flex flex-col items-center gap-2">
        <StarInput value={rating} onChange={setRating} size="h-9 w-9" />
      </div>
      {order.items.length > 1 && rating > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-muted">Rate each dish (optional)</p>
          {order.items.map((i) => (
            <div key={i.dishId} className="flex items-center justify-between gap-2">
              <span className="truncate text-sm">{i.name}</span>
              <StarInput value={dishStars[i.dishId] ?? 0} onChange={(n) => setDishStars({ ...dishStars, [i.dishId]: n })} size="h-5 w-5" />
            </div>
          ))}
        </div>
      )}
      <textarea
        className="input mt-5"
        rows={3}
        maxLength={300}
        placeholder="Tell the restaurant what you liked (optional)"
        value={review}
        onChange={(e) => setReview(e.target.value)}
      />
      <button className="btn-primary mt-4 w-full" disabled={!rating || saving} onClick={submit}>
        {saving && <Spinner className="h-4 w-4" />} Submit rating
      </button>
    </Modal>
  )
}
