import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bike, Building2, CheckCircle2, DoorOpen, Phone, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi, useInterval } from '../../lib/useApi'
import { money, time } from '../../lib/format'
import { useLiveEvent } from '../../context/LiveContext'
import { EmptyState, ErrorBox, Modal, PageHeader, PageLoader, Spinner, StatusBadge } from '../../components/ui'

/** Today's faculty delivery orders, grouped run → building, with cash to collect. */
function groupRuns(orders) {
  const runs = new Map()
  for (const o of orders) {
    const key = o.delivery.run
    const run = runs.get(key) ?? { run: key, places: new Map(), orders: [] }
    run.orders.push(o)
    const place = run.places.get(o.delivery.location) ?? []
    place.push(o)
    run.places.set(o.delivery.location, place)
    runs.set(key, run)
  }
  return [...runs.values()].sort((a, b) => new Date(a.run) - new Date(b.run))
}

const cash = (orders) => orders.reduce((sum, o) => sum + Number(o.total), 0)
const hhmm = (iso) => iso.slice(11, 16)

export default function Deliveries() {
  const { data, setData, loading, error, reload } = useApi(() => api.get('/restaurant/orders/active').then((r) => r.data), [])
  useLiveEvent(['NEW_ORDER', 'ORDER_BOOKED', 'ORDER_CANCELLED', 'ORDER_COLLECTED'], () => reload({ silent: true }))
  useInterval(() => reload({ silent: true }), 30_000)
  const [busy, setBusy] = useState(null)
  const [handing, setHanding] = useState(null)
  const [otp, setOtp] = useState('')

  // A missed delivery became a counter pickup – it shows on the Orders screen instead
  const runs = useMemo(() => groupRuns((data ?? []).filter((o) => o.delivery && !o.delivery.missed)), [data])

  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const replace = (updated) => setData((list) => list.map((o) => (o.id === updated.id ? updated : o)))

  const startRun = async (run) => {
    const waiting = run.orders.filter((o) => o.status !== 'ON_THE_WAY').length
    if (!confirm(`Start the ${time(run.run)} delivery with ${waiting} order${waiting === 1 ? '' : 's'}? Everyone gets "on the way".`)) return
    setBusy(run.run)
    try {
      const { data: out } = await api.post('/restaurant/orders/deliveries/start', { run: hhmm(run.run) })
      out.forEach(replace)
      toast.success(`${out.length} order${out.length === 1 ? ' is' : 's are'} on the way`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const deliver = async (e) => {
    e.preventDefault()
    setBusy(handing.id)
    try {
      await api.post('/restaurant/orders/verify', { token: handing.token, otp })
      setData((list) => list.filter((o) => o.id !== handing.id))
      toast.success(`${handing.token} delivered – collect ${money(handing.total)}`)
      setHanding(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const missed = async (o) => {
    if (!confirm(`Nobody at ${o.delivery.location}, ${o.delivery.room}? ${o.token} becomes a counter pickup and the customer is told.`)) return
    setBusy(o.id)
    try {
      await api.post(`/restaurant/orders/${o.id}/delivery-missed`)
      setData((list) => list.filter((x) => x.id !== o.id))
      toast(`${o.token} moved to counter pickup`)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title="Deliveries" subtitle="Faculty orders by delivery time and building" />
      {!runs.length ? (
        <EmptyState
          icon={Bike}
          title="No deliveries waiting"
          text="Faculty delivery orders for today's runs show up here."
          action={<Link to="/kitchen/settings" className="btn-secondary"><Settings className="h-4 w-4" /> Delivery settings</Link>}
        />
      ) : (
        <div className="space-y-6">
          {runs.map((run) => {
            const waiting = run.orders.filter((o) => o.status !== 'ON_THE_WAY')
            return (
              <section key={run.run} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-brand-50/60 p-4 dark:border-slate-800 dark:bg-brand-500/5">
                  <div>
                    <h2 className="font-display text-2xl font-extrabold">{time(run.run)} run</h2>
                    <p className="text-sm text-muted">{run.orders.length} order{run.orders.length === 1 ? '' : 's'} · {money(cash(run.orders))} to collect</p>
                  </div>
                  {waiting.length > 0 && (
                    <button className="btn-primary" disabled={busy === run.run} onClick={() => startRun(run)}>
                      {busy === run.run ? <Spinner className="h-4 w-4" /> : <Bike className="h-4 w-4" />} Start run ({waiting.length})
                    </button>
                  )}
                </div>
                {[...run.places.entries()].map(([place, orders]) => (
                  <div key={place} className="border-b border-line last:border-0 dark:border-slate-800">
                    <p className="flex items-center gap-2 px-4 pt-3 text-sm font-bold text-brand">
                      <Building2 className="h-4 w-4" /> {place} · {orders.length} · {money(cash(orders))}
                    </p>
                    <ul className="divide-y divide-line dark:divide-slate-800">
                      {orders.map((o) => (
                        <li key={o.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="flex flex-wrap items-center gap-2">
                                <span className="font-display text-lg font-extrabold">{o.token}</span>
                                <span className="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><DoorOpen className="h-3 w-3" /> Room {o.delivery.room}</span>
                                <StatusBadge status={o.status} />
                              </p>
                              <p className="mt-1 text-sm">{o.studentName}</p>
                              <p className="text-sm text-muted">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-bold tabular-nums">{money(o.total)}</p>
                              {o.delivery.phone && (
                                <a href={`tel:${o.delivery.phone}`} className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">
                                  <Phone className="h-4 w-4" /> Call
                                </a>
                              )}
                            </div>
                          </div>
                          {o.status === 'ON_THE_WAY' && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button className="btn-success" disabled={busy === o.id} onClick={() => { setHanding(o); setOtp('') }}>
                                <CheckCircle2 className="h-4 w-4" /> Delivered
                              </button>
                              <button className="btn-secondary" disabled={busy === o.id} onClick={() => missed(o)}>
                                Not in room
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )
          })}
        </div>
      )}

      <Modal open={!!handing} onClose={() => setHanding(null)} title={`Hand over ${handing?.token ?? ''}`}>
        <form onSubmit={deliver}>
          <label className="label" htmlFor="delivery-otp">Ask for their 4-digit OTP</label>
          <input
            id="delivery-otp"
            autoFocus
            required
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="one-time-code"
            className="input text-center font-display text-3xl tracking-[0.5em]"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <p className="mt-3 text-center text-sm">Collect <b>{handing && money(handing.total)}</b> in cash</p>
          <button className="btn-success mt-4 w-full" disabled={otp.length !== 4 || busy === handing?.id}>
            {busy === handing?.id && <Spinner className="h-4 w-4" />} Confirm delivered
          </button>
        </form>
      </Modal>
    </>
  )
}
