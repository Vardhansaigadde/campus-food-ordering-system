import { useEffect, useState } from 'react'
import { Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { ErrorBox, PageHeader, PageLoader, Spinner, Toggle } from '../../components/ui'
import PhotoPicker from '../../components/PhotoPicker'
import DeliverySettings from '../../components/DeliverySettings'
import { ChangePassword } from '../student/Account'

export default function Settings() {
  const { data, setData, loading, error, reload } = useApi(() => api.get('/restaurant/profile').then((r) => r.data), [])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) {
      setForm({
        description: data.description ?? '',
        imageUrl: data.imageUrl ?? '',
        openingHours: data.openingHours ?? '',
        autoCloseTime: data.autoCloseTime ? data.autoCloseTime.slice(0, 5) : '',
        autoOpenTime: data.autoOpenTime ? data.autoOpenTime.slice(0, 5) : '',
        holdMinutes: data.holdMinutes ?? 45,
        preordersEnabled: Boolean(data.preordersEnabled),
      })
    }
  }, [data])

  if (loading || (!form && !error)) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: updated } = await api.put('/restaurant/profile', {
        ...form,
        autoCloseTime: form.autoCloseTime ? `${form.autoCloseTime}:00` : null,
        autoOpenTime: form.autoOpenTime ? `${form.autoOpenTime}:00` : null,
        holdMinutes: Number(form.holdMinutes),
      })
      setData(updated)
      toast.success('Saved')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Settings" />
      <form onSubmit={save} className="card space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-brand" />
          <div>
            <p className="font-semibold">{data.name}</p>
            <p className="text-xs text-muted">Order IDs start with <b>{data.code}-</b> · name and code are managed by the canteen office</p>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="desc">Description</label>
          <textarea id="desc" rows={2} maxLength={300} className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="img">Canteen photo</label>
          <PhotoPicker id="img" kind="restaurant" value={form.imageUrl} onChange={(url) => setForm((r) => ({ ...r, imageUrl: url }))} uploadPath="/restaurant/photos" alt={form.name} />
        </div>
        <div>
          <label className="label" htmlFor="hours">Opening hours (shown to students)</label>
          <input id="hours" maxLength={60} className="input" placeholder="8:00 AM – 8:00 PM" value={form.openingHours} onChange={(e) => setForm({ ...form, openingHours: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="open">Open automatically at</label>
            <input id="open" type="time" className="input" value={form.autoOpenTime} onChange={(e) => setForm({ ...form, autoOpenTime: e.target.value })} />
            <p className="mt-1 text-xs text-muted">Opens with yesterday's menu.</p>
          </div>
          <div>
            <label className="label" htmlFor="close">Close automatically at</label>
            <input id="close" type="time" className="input" value={form.autoCloseTime} onChange={(e) => setForm({ ...form, autoCloseTime: e.target.value })} />
            <p className="mt-1 text-xs text-muted">Sends you the day's cash summary.</p>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="hold">Keep food for a student who doesn't come</label>
          <select id="hold" className="input" value={form.holdMinutes} onChange={(e) => setForm({ ...form, holdMinutes: e.target.value })}>
            {/* Always include the saved value, so an unusual one is shown as it is, not silently replaced */}
            {[...new Set([15, 20, 30, 45, 60, 90, 120, Number(form.holdMinutes)])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? 's' : ''}`}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted">Then it's a no-show and the plates go back on sale.</p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line p-4 dark:border-slate-700">
          <div>
            <p className="font-semibold">Accept pre-orders</p>
            <p className="text-sm text-muted">Students order now for a later time today.</p>
          </div>
          <Toggle checked={form.preordersEnabled} onChange={(v) => setForm({ ...form, preordersEnabled: v })} label="Accept pre-orders" />
        </div>
        <button className="btn-primary" disabled={saving}>{saving && <Spinner className="h-4 w-4" />} Save</button>
      </form>
      <DeliverySettings />
      <ChangePassword />
    </div>
  )
}
