import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock, CheckCheck, ChefHat, ClipboardList, Inbox, PackageCheck, ShieldCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi, useInterval } from '../../lib/useApi'
import { minutesAgo, money, time } from '../../lib/format'
import { useLiveEvent } from '../../context/LiveContext'
import { ErrorBox, Modal, PageLoader, Spinner, VegMark } from '../../components/ui'
import PushPrompt from '../../components/PushPrompt'
import { withSnapshot } from '../../lib/offline'

// Orders are confirmed automatically: ready-made food goes straight to "To collect",
// anything made fresh to "To cook". "New" only appears for older orders still waiting.
const COLUMNS = [
  { status: 'PLACED', title: 'New', short: 'New', icon: Inbox, tone: 'border-sky-400', head: 'text-sky-600' },
  { status: 'PREPARING', title: 'To cook', short: 'To cook', icon: ChefHat, tone: 'border-amber-400', head: 'text-amber-600' },
  { status: 'READY', title: 'To collect', short: 'To collect', icon: PackageCheck, tone: 'border-emerald-400', head: 'text-emerald-600' },
]

const REJECT_REASONS = ['Item finished / sold out', 'Kitchen closing', 'Too many orders right now', 'Ingredient not available']

function OrderCard({ order, onAction, busy }) {
  const preorder = order.pickupTime && new Date(order.pickupTime) > new Date(Date.now() + 10 * 60000)
  return (
    <div className={`card animate-pop p-4 ${preorder ? 'opacity-80' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-black tracking-tight">{order.token}</p>
          <p className="text-xs text-muted">{order.studentName} · {minutesAgo(order.createdAt)}</p>
        </div>
        <span className="text-right font-bold tabular-nums">{money(order.total)}</span>
      </div>
      {order.pickupTime && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-purple-100 px-2 py-1 text-xs font-bold text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
          <AlarmClock className="h-3.5 w-3.5" /> Pre-order · pickup {time(order.pickupTime)}
        </p>
      )}
      <ul className="mt-3 space-y-1">
        {order.items.map((i) => (
          <li key={i.dishId} className={`flex items-center gap-2 text-sm ${order.status === 'PREPARING' && i.readyMade ? 'text-muted' : ''}`}>
            <VegMark veg={i.veg} />
            <span className="font-bold tabular-nums">{i.quantity}×</span> {i.name}
            {order.status === 'PREPARING' && i.readyMade && <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">ready-made</span>}
          </li>
        ))}
      </ul>
      {order.note && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Note: {order.note}</p>}

      <div className="mt-4 flex gap-2">
        {order.status === 'PLACED' && (
          <>
            <button className="btn-primary flex-1" disabled={busy} onClick={() => onAction('accept', order)}>
              {busy ? <Spinner className="h-4 w-4" /> : <ChefHat className="h-4 w-4" />} Start preparing
            </button>
            <button className="btn-secondary px-3" disabled={busy} onClick={() => onAction('reject', order)} aria-label={`Reject ${order.token}`}>
              <X className="h-4 w-4" />
            </button>
          </>
        )}
        {order.status === 'PREPARING' && (
          <>
            <button className="btn-success flex-1" disabled={busy} onClick={() => onAction('ready', order)}>
              {busy ? <Spinner className="h-4 w-4" /> : <CheckCheck className="h-4 w-4" />} Mark ready
            </button>
            <button className="btn-secondary px-3" disabled={busy} onClick={() => onAction('reject', order)} aria-label={`Reject ${order.token}`}>
              <X className="h-4 w-4" />
            </button>
          </>
        )}
        {order.status === 'READY' && (
          <Link to="/kitchen/verify" state={{ token: order.token }} className="btn-secondary flex-1">
            <ShieldCheck className="h-4 w-4" /> Verify & hand over
          </Link>
        )}
      </div>
      {order.status === 'READY' && <p className="mt-2 text-center text-xs text-muted">Ready since {time(order.readyAt)} – waiting for student</p>}
    </div>
  )
}

export default function LiveOrders() {
  const [offlineAt, setOfflineAt] = useState(null)
  const { data, setData, loading, error, reload } = useApi(
    () => withSnapshot('active-orders', () => api.get('/restaurant/orders/active').then((r) => r.data), setOfflineAt),
    [],
  )
  const profile = useApi(() => withSnapshot('profile', () => api.get('/restaurant/profile').then((r) => r.data), () => {}), [])
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')
  const [tab, setTab] = useState(null) // phones show one column at a time

  // New orders arrive instantly through the live connection; slow poll as backup
  useLiveEvent(['NEW_ORDER', 'ORDER_BOOKED', 'ORDER_CANCELLED', 'ORDER_COLLECTED', 'ORDER_NO_SHOW'], () => reload({ silent: true }))
  useInterval(() => reload({ silent: true }), 30_000)

  const act = async (action, order) => {
    if (action === 'reject') {
      setRejecting(order)
      setReason(REJECT_REASONS[0])
      return
    }
    setBusyId(order.id)
    try {
      const { data: updated } = await api.post(`/restaurant/orders/${order.id}/${action}`)
      setData((list) => list.map((o) => (o.id === updated.id ? updated : o)))
      if (action === 'ready') toast.success(`${order.token} is ready – the student has been notified`)
    } catch (e) {
      toast.error(errorMessage(e))
      reload({ silent: true })
    } finally {
      setBusyId(null)
    }
  }

  const confirmReject = async () => {
    setBusyId(rejecting.id)
    try {
      await api.post(`/restaurant/orders/${rejecting.id}/reject`, { reason })
      setData((list) => list.filter((o) => o.id !== rejecting.id))
      toast.success(`${rejecting.token} rejected – stock returned`)
      setRejecting(null)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const columns = COLUMNS.filter((c) => c.status !== 'PLACED' || data.some((o) => o.status === 'PLACED'))
  // Phones open on whatever needs the cook first
  const shown = tab ?? (data.some((o) => o.status === 'PREPARING' || o.status === 'PLACED') ? 'PREPARING' : 'READY')

  return (
    <>
      {offlineAt && (
        <div role="status" className="mb-4 rounded-[20px] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <p className="font-bold">No internet – showing the list from {time(new Date(offlineAt))}</p>
          <p className="mt-0.5">You can still hand over: type the Order ID + OTP on Scan. It is confirmed automatically when the internet is back.</p>
        </div>
      )}
      <PushPrompt
        title="Turn on cooking alerts"
        text="Get a buzz when an order needs cooking (fried rice, starters…) even when this phone is locked. Ready-made orders like biryani need nothing from you until the student arrives."
      />
      {profile.data && profile.data.dishesToday === 0 && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Today's menu is empty – students can't see any dishes yet.
          </p>
          <Link to="/kitchen/menu" className="btn-primary py-2">Set today's menu</Link>
        </div>
      )}

      <div className="sticky top-16 z-20 md:top-[117px] -mx-4 mb-4 grid gap-1.5 bg-cream/95 px-4 py-2 backdrop-blur lg:hidden dark:bg-slate-950/95" role="tablist" aria-label="Order status" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((col) => {
          const count = data.filter((o) => o.status === col.status).length
          const active = shown === col.status
          return (
            <button
              key={col.status}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(col.status)}
              className={`flex min-h-12 items-center justify-center gap-1.5 rounded-full border-2 px-1 text-sm font-bold ${active ? `${col.tone} bg-white dark:bg-slate-900` : 'border-transparent bg-slate-200/70 text-muted dark:bg-slate-800'}`}
            >
              {col.short}
              <span className={`min-w-6 rounded-full px-1.5 text-xs ${count > 0 && col.status !== 'READY' ? 'bg-brand-500 text-white' : 'bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-200'}`}>{count}</span>
            </button>
          )
        })}
      </div>

      <div className={`grid gap-5 ${columns.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {columns.map((col) => {
          const orders = data.filter((o) => o.status === col.status)
          return (
            <section key={col.status} className={`rounded-2xl border-t-4 ${col.tone} bg-slate-100/70 p-3 dark:bg-slate-900/50 ${shown === col.status ? '' : 'hidden lg:block'}`}>
              <h2 className={`mb-3 flex items-center justify-between px-1 font-bold ${col.head}`}>
                <span className="flex items-center gap-2"><col.icon className="h-5 w-5" /> {col.title}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{orders.length}</span>
              </h2>
              <div className="space-y-3">
                {orders.length === 0 ? (
                  <p className="flex flex-col items-center gap-2 py-10 text-sm text-muted">
                    <ClipboardList className="h-6 w-6" /> Nothing here
                  </p>
                ) : (
                  orders.map((o) => <OrderCard key={o.id} order={o} onAction={act} busy={busyId === o.id} />)
                )}
              </div>
            </section>
          )
        })}
      </div>

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={`Reject order ${rejecting?.token ?? ''}`}>
        <p className="mb-3 text-sm text-muted">The student is notified immediately and the dishes go back into stock.</p>
        <div className="space-y-2">
          {REJECT_REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-brand-500" />
              <span className="text-sm">{r}</span>
            </label>
          ))}
          <input className="input" maxLength={150} placeholder="Or type a reason…" value={REJECT_REASONS.includes(reason) ? '' : reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setRejecting(null)}>Back</button>
          <button className="btn-danger" disabled={!reason.trim() || busyId === rejecting?.id} onClick={confirmReject}>
            {busyId === rejecting?.id && <Spinner className="h-4 w-4" />} Reject order
          </button>
        </div>
      </Modal>
    </>
  )
}
