import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Banknote, CheckCircle2, Receipt, UserX, XCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { isoDate, money, time } from '../../lib/format'
import { useChartColors } from '../../components/charts'
import { ErrorBox, PageHeader, PageLoader, StatCard, StatusBadge } from '../../components/ui'

/** Small number tile for phones (3 in a row). */
function MiniStat({ label, value, tone = '' }) {
  return (
    <div className="card p-3 text-center">
      <p className={`text-2xl font-black tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs leading-tight text-muted">{label}</p>
    </div>
  )
}

export default function Summary() {
  const [day, setDay] = useState(isoDate())
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const summary = useApi(() => api.get('/restaurant/orders/summary', { params: { date: day } }).then((r) => r.data), [day])
  const walkIn = useApi(() => api.get('/restaurant/menu/counter-sales/summary', { params: { date: day } }).then((r) => r.data), [day])
  const history = useApi(
    () => api.get('/restaurant/orders', { params: { date: day, status: status || undefined, page, size: 25 } }).then((r) => r.data),
    [day, status, page],
  )
  const colors = useChartColors()

  const s = summary.data
  const w = walkIn.data ?? { plates: 0, amount: 0, dishes: [] }
  // App orders are paid in cash at pickup, walk-ins at the counter: both end up in the same box
  const cashInBox = s ? Number(s.expectedCash) + Number(w.amount) : 0
  const hours = s ? s.ordersByHour.map((count, hour) => ({ hour: `${hour}:00`, count })).filter((h, i) => i >= 7 && i <= 22) : []

  return (
    <>
      <PageHeader
        title="Day summary"
        subtitle="End-of-day totals – match the expected cash with your cash box."
        actions={<input type="date" className="input w-auto" value={day} max={isoDate()} onChange={(e) => { setDay(e.target.value || isoDate()); setPage(0) }} aria-label="Date" />}
      />
      {summary.loading ? (
        <PageLoader />
      ) : summary.error ? (
        <ErrorBox message={summary.error} onRetry={summary.reload} />
      ) : (
        <>
          {/* Phones: the cash figure the owner matches against the cash box, big and first */}
          <div className="sm:hidden">
            <div className="rounded-2xl bg-emerald-700 p-5 text-white">
              <p className="flex items-center gap-2 text-sm font-semibold text-white/90"><Banknote className="h-5 w-5" /> Expected cash in box</p>
              <p className="mt-1 text-4xl font-black tabular-nums">{money(cashInBox)}</p>
              <p className="text-xs text-white/85">
                {money(s.expectedCash)} from {s.byStatus.COLLECTED} app orders + {money(w.amount)} from {w.plates} walk-in plates
              </p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="Orders" value={s.totalOrders} />
              <MiniStat label="Collected" value={s.byStatus.COLLECTED} tone="text-emerald-700 dark:text-emerald-400" />
              <MiniStat label="No-show / rejected" value={`${s.byStatus.NO_SHOW}/${s.byStatus.REJECTED}`} tone="text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Banknote} label="Expected cash in box" value={money(cashInBox)} hint={`app ${money(s.expectedCash)} + walk-in ${money(w.amount)}`} tone="green" />
            <StatCard icon={Receipt} label="Orders" value={s.totalOrders} tone="blue" />
            <StatCard icon={CheckCircle2} label="Collected" value={s.byStatus.COLLECTED} />
            <StatCard icon={UserX} label="No-show / rejected" value={`${s.byStatus.NO_SHOW} / ${s.byStatus.REJECTED}`} tone="red" />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="card p-4 sm:p-5 lg:col-span-2">
              <h2 className="mb-4 font-semibold">Orders by hour</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hours} margin={{ left: -20 }}>
                  <CartesianGrid vertical={false} stroke={colors.grid} />
                  <XAxis dataKey="hour" tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: colors.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={colors.tooltip} cursor={{ fill: colors.cursor }} />
                  <Bar dataKey="count" name="Orders" fill="#c2410c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-4 sm:p-5">
              <h2 className="mb-4 font-semibold">Top dishes (app)</h2>
              {s.topDishes.length === 0 ? (
                <p className="text-sm text-muted">No orders yet</p>
              ) : (
                <ol className="space-y-3">
                  {s.topDishes.map((d, i) => (
                    <li key={d.label} className="flex items-center gap-3 text-sm">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand dark:bg-brand-500/10">{i + 1}</span>
                      <span className="flex-1">{d.label}</span>
                      <b>{d.value}</b>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          <div className="mt-4 card p-4 sm:p-5">
            <h2 className="mb-3 font-semibold">Walk-in sales at the counter</h2>
            {w.dishes.length === 0 ? (
              <p className="text-sm text-muted">No counter sales recorded. Tap "−1 Sold at counter" on the Today screen for each walk-in plate.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {w.dishes.map((d) => (
                  <li key={d.dish} className="flex items-center justify-between gap-3 py-2">
                    <span>{d.dish}</span>
                    <span className="tabular-nums"><b>{d.plates}</b> plates · {money(d.amount)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3 pt-2 font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">{w.plates} plates · {money(w.amount)}</span>
                </li>
              </ul>
            )}
          </div>
        </>
      )}

      <div className="mt-6 card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <h2 className="font-semibold">Orders</h2>
          <select className="input w-auto py-2" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} aria-label="Filter by status">
            <option value="">All statuses</option>
            {['PLACED', 'PREPARING', 'READY', 'COLLECTED', 'REJECTED', 'CANCELLED', 'NO_SHOW'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        {history.loading ? (
          <PageLoader />
        ) : history.error ? (
          <ErrorBox message={history.error} onRetry={history.reload} />
        ) : history.data.content.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">No orders</p>
        ) : (
          <>
          <ul className="divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
            {history.data.content.map((o) => (
              <li key={o.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-lg font-black">{o.token}</span>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-0.5 text-sm text-muted">{o.studentName} · {time(o.createdAt)} · <b className="text-ink tabular-nums dark:text-slate-100">{money(o.total)}</b></p>
                <p className="mt-1 text-sm">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p>
                {o.rating && <p className="mt-1 text-xs text-amber-600">{'★'.repeat(o.rating)}{o.review && <span className="ml-1 italic text-muted">"{o.review}"</span>}</p>}
                {o.rejectReason && <p className="mt-1 text-xs text-red-600"><XCircle className="mr-1 inline h-3 w-3" />{o.rejectReason}</p>}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-2.5">Order</th><th className="px-4 py-2.5">Student</th><th className="px-4 py-2.5">Items</th>
                  <th className="px-4 py-2.5">Total</th><th className="px-4 py-2.5">Placed</th><th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.data.content.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2.5 font-bold">{o.token}</td>
                    <td className="px-4 py-2.5">{o.studentName}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-muted">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</td>
                    <td className="px-4 py-2.5 tabular-nums">{money(o.total)}</td>
                    <td className="px-4 py-2.5 text-muted">{time(o.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={o.status} />
                      {o.rating && <span className="ml-2 text-xs text-amber-500">{'★'.repeat(o.rating)}</span>}
                      {o.review && <p className="mt-1 max-w-xs text-xs italic text-muted">"{o.review}"</p>}
                      {o.rejectReason && <p className="mt-1 text-xs text-red-500"><XCircle className="mr-1 inline h-3 w-3" />{o.rejectReason}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        {history.data?.totalPages > 1 && (
          <div className="grid grid-cols-2 gap-2 border-t sm:flex sm:justify-end border-slate-100 p-3 dark:border-slate-800">
            <button className="btn-secondary py-1.5" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn-secondary py-1.5" disabled={page + 1 >= history.data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </>
  )
}
