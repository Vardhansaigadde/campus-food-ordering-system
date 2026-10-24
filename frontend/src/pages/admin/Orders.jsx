import { useState } from 'react'
import { Download, LockOpen, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { dateTime, isoDate, money, time } from '../../lib/format'
import { ErrorBox, Modal, PageHeader, PageLoader, Spinner, StatusBadge, VegMark } from '../../components/ui'

export default function Orders() {
  const [filters, setFilters] = useState({ from: isoDate(), to: isoDate(), restaurantId: '', status: '', q: '' })
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const [exporting, setExporting] = useState(false)
  const restaurants = useApi(() => api.get('/admin/restaurants').then((r) => r.data), [])
  const params = { ...filters, restaurantId: filters.restaurantId || undefined, status: filters.status || undefined, q: filters.q || undefined }
  const { data, loading, error, reload } = useApi(
    () => api.get('/admin/orders', { params: { ...params, page, size: 25 } }).then((r) => r.data),
    [JSON.stringify(filters), page],
  )

  const set = (field) => (e) => {
    setFilters({ ...filters, [field]: e.target.value })
    setPage(0)
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const res = await api.get('/admin/orders/export', {
        params: { from: filters.from, to: filters.to, restaurantId: filters.restaurantId || undefined },
        responseType: 'blob',
        timeout: 120000,
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders_${filters.from}_to_${filters.to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(errorMessage(e, 'Export failed'))
    } finally {
      setExporting(false)
    }
  }

  const unlock = async (order) => {
    try {
      const { data: o } = await api.post(`/admin/orders/${order.id}/unlock-otp`)
      setSelected(o)
      toast.success(`OTP unlocked for ${o.token}`)
      reload({ silent: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title="All orders"
        actions={
          <button className="btn-secondary" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Spinner className="h-4 w-4" /> : <Download className="h-4 w-4" />} Export to Excel (CSV)
          </button>
        }
      />
      <div className="card mb-4 grid grid-cols-2 gap-3 p-4 lg:grid-cols-5">
        <label className="text-xs text-muted">From<input type="date" className="input mt-1" value={filters.from} max={filters.to} onChange={set('from')} /></label>
        <label className="text-xs text-muted">To<input type="date" className="input mt-1" value={filters.to} min={filters.from} max={isoDate()} onChange={set('to')} /></label>
        <label className="text-xs text-muted">Restaurant
          <select className="input mt-1" value={filters.restaurantId} onChange={set('restaurantId')}>
            <option value="">All</option>
            {(restaurants.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">Status
          <select className="input mt-1" value={filters.status} onChange={set('status')}>
            <option value="">All</option>
            {['PLACED', 'PREPARING', 'READY', 'ON_THE_WAY', 'COLLECTED', 'REJECTED', 'CANCELLED', 'NO_SHOW'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="col-span-2 text-xs text-muted lg:col-span-1">Search
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Order ID or student" value={filters.q} onChange={set('q')} />
          </div>
        </label>
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {data.content.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">No orders match these filters</li>}
            {data.content.map((o) => (
              <li key={o.id}>
                <button className="w-full p-4 text-left active:bg-slate-50 dark:active:bg-slate-800/40" onClick={() => setSelected(o)}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-lg font-black">{o.token}</span>
                    <span className="flex items-center gap-1"><StatusBadge status={o.status} />{o.otpLocked && <span className="chip bg-red-100 text-red-700">OTP locked</span>}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{o.restaurantName} · {o.studentName}</span>
                  <span className="mt-0.5 block text-sm text-muted">{dateTime(o.createdAt)} · <b className="tabular-nums text-ink dark:text-slate-100">{money(o.total)}</b></span>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-2.5">Order</th><th className="px-4 py-2.5">Restaurant</th><th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">Total</th><th className="px-4 py-2.5">Placed</th><th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.content.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">No orders match these filters</td></tr>
                )}
                {data.content.map((o) => (
                  <tr key={o.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => setSelected(o)}>
                    <td className="px-4 py-2.5 font-bold">{o.token}</td>
                    <td className="px-4 py-2.5">{o.restaurantName}</td>
                    <td className="px-4 py-2.5">{o.studentName}</td>
                    <td className="px-4 py-2.5 tabular-nums">{money(o.total)}</td>
                    <td className="px-4 py-2.5 text-muted">{dateTime(o.createdAt)}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={o.status} />{o.otpLocked && <span className="chip ml-1 bg-red-100 text-red-700">OTP locked</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 p-3 text-sm text-muted dark:border-slate-800">
            <span>{data.totalElements} orders</span>
            <div className="flex gap-2">
              <button className="btn-secondary py-1.5" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="btn-secondary py-1.5" disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Order ${selected?.token ?? ''}`}>
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted">{selected.restaurantName}</span><StatusBadge status={selected.status} /></div>
            <p>Student: <b>{selected.studentName}</b></p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {selected.items.map((i) => (
                <li key={i.dishId} className="flex items-center gap-2 px-3 py-2"><VegMark veg={i.veg} /><span className="flex-1">{i.quantity} × {i.name}</span>{money(i.lineTotal)}</li>
              ))}
            </ul>
            <p className="text-right text-base font-bold">Total {money(selected.total)}</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-muted">
              <span>Placed: {dateTime(selected.createdAt)}</span>
              {selected.pickupTime && <span>Pickup: {time(selected.pickupTime)}</span>}
              {selected.acceptedAt && <span>Accepted: {time(selected.acceptedAt)}</span>}
              {selected.readyAt && <span>Ready: {time(selected.readyAt)}</span>}
              {selected.collectedAt && <span>Collected: {time(selected.collectedAt)}</span>}
            </div>
            {selected.rejectReason && <p className="text-red-600">Reason: {selected.rejectReason}</p>}
            {selected.review && <p className="italic text-muted">"{selected.review}" {'★'.repeat(selected.rating ?? 0)}</p>}
            {selected.otpLocked && (
              <button className="btn-secondary w-full" onClick={() => unlock(selected)}>
                <LockOpen className="h-4 w-4" /> Unlock OTP (too many wrong attempts)
              </button>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
