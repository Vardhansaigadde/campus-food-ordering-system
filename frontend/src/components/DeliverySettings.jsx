import { useState } from 'react'
import { Bike, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../lib/api'
import { useApi } from '../lib/useApi'
import { ErrorBox, PageLoader, Spinner, Toggle } from './ui'

const CUTOFFS = [15, 20, 30, 45, 60, 90]

/** Owner settings for faculty delivery: on/off, run times, fee, minimum order, buildings. */
export default function DeliverySettings() {
  const { data, loading, error, reload } = useApi(async () => {
    const [settings, places] = await Promise.all([
      api.get('/restaurant/delivery').then((r) => r.data),
      api.get('/locations').then((r) => r.data),
    ])
    return { settings, places }
  }, [])
  const [form, setForm] = useState(null)
  const [newRun, setNewRun] = useState('12:45')
  const [saving, setSaving] = useState(false)

  if (data && !form) {
    const s = data.settings
    setForm({
      enabled: s.enabled,
      fee: String(Number(s.fee ?? 0)),
      minOrder: s.minOrder ? String(Number(s.minOrder)) : '',
      runs: s.runs.map((r) => r.slice(0, 5)),
      cutoffMinutes: s.cutoffMinutes ?? 30,
      locationIds: s.locationIds,
    })
  }
  if (loading || (!form && !error)) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const addRun = () => {
    if (!newRun || form.runs.includes(newRun)) return
    setForm({ ...form, runs: [...form.runs, newRun].sort() })
  }
  const togglePlace = (id) =>
    setForm({ ...form, locationIds: form.locationIds.includes(id) ? form.locationIds.filter((x) => x !== id) : [...form.locationIds, id] })

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: saved } = await api.put('/restaurant/delivery', {
        enabled: form.enabled,
        fee: Number(form.fee || 0),
        minOrder: form.minOrder ? Number(form.minOrder) : null,
        runs: form.runs,
        cutoffMinutes: Number(form.cutoffMinutes),
        locationIds: form.locationIds,
      })
      setForm({ ...form, enabled: saved.enabled })
      toast.success(saved.enabled ? 'Faculty delivery is on' : 'Saved – faculty delivery is off')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Bike className="h-5 w-5 text-brand" /> Faculty delivery</h2>
          <p className="text-sm text-muted">Approved faculty can order food to their room. You deliver on fixed runs.</p>
        </div>
        <Toggle checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} label="Faculty delivery on or off" />
      </div>

      <div>
        <span className="label">Delivery times</span>
        <div className="flex flex-wrap gap-2">
          {form.runs.map((r) => (
            <span key={r} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-brand-50 pl-4 pr-1 font-semibold text-brand dark:bg-brand-500/10">
              {r}
              <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-100 dark:hover:bg-brand-500/20" onClick={() => setForm({ ...form, runs: form.runs.filter((x) => x !== r) })} aria-label={`Remove ${r} delivery`}>
                <X className="h-4 w-4" />
              </button>
            </span>
          ))}
          {form.runs.length < 6 && (
            <span className="inline-flex items-center gap-1">
              <input type="time" className="input w-32" value={newRun} onChange={(e) => setNewRun(e.target.value)} aria-label="New delivery time" />
              <button type="button" className="btn-secondary" onClick={addRun}><Plus className="h-4 w-4" /> Add</button>
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">One trip per time takes every order for it, e.g. 12:45 and 1:30.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">Delivery fee (₹)</span>
          <input type="number" min="0" max="500" step="1" inputMode="numeric" className="input" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Minimum order (₹)</span>
          <input type="number" min="0" max="5000" step="1" inputMode="numeric" className="input" placeholder="None" value={form.minOrder} onChange={(e) => setForm({ ...form, minOrder: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">Orders close</span>
          <select className="input" value={form.cutoffMinutes} onChange={(e) => setForm({ ...form, cutoffMinutes: e.target.value })}>
            {[...new Set([...CUTOFFS, Number(form.cutoffMinutes)])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m} min before</option>)}
          </select>
        </label>
      </div>

      <div>
        <span className="label">Buildings you deliver to</span>
        {data.places.length ? (
          <div className="flex flex-wrap gap-2">
            {data.places.map((p) => {
              const on = form.locationIds.includes(p.id)
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => togglePlace(p.id)}
                  aria-pressed={on}
                  className={`min-h-11 rounded-full border-2 px-4 text-sm font-semibold ${on ? 'border-brand-500 bg-brand-50 text-brand dark:bg-brand-500/10' : 'border-slate-200 text-muted dark:border-slate-700'}`}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">The canteen office hasn't added any buildings yet.</p>
        )}
      </div>

      <button className="btn-primary" disabled={saving}>{saving && <Spinner className="h-4 w-4" />} Save delivery settings</button>
    </form>
  )
}
