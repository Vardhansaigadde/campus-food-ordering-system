import { useState } from 'react'
import { Megaphone, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { dateTime, localDateTime } from '../../lib/format'
import { EmptyState, ErrorBox, PageHeader, PageLoader, Spinner } from '../../components/ui'

const LEVELS = {
  INFO: 'bg-sky-600',
  WARNING: 'bg-amber-500',
  SUCCESS: 'bg-emerald-600',
}

export default function Announcements() {
  const { data, setData, loading, error, reload } = useApi(() => api.get('/admin/announcements').then((r) => r.data), [])
  const [form, setForm] = useState({ message: '', level: 'INFO', expiresAt: '' })
  const [saving, setSaving] = useState(false)

  const post = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: created } = await api.post('/admin/announcements', {
        message: form.message,
        level: form.level,
        expiresAt: form.expiresAt ? localDateTime(new Date(form.expiresAt)) : null,
      })
      setData((list) => [created, ...list])
      setForm({ message: '', level: 'INFO', expiresAt: '' })
      toast.success('Announcement is live on every screen')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (a) => {
    try {
      await api.delete(`/admin/announcements/${a.id}`)
      setData((list) => list.map((x) => (x.id === a.id ? { ...x, active: false } : x)))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Announcements" subtitle="Shown as a banner to every student and restaurant, instantly." />
      <form onSubmit={post} className="card mb-6 space-y-4 p-5">
        <textarea required maxLength={300} rows={2} className="input" placeholder="e.g. All canteens will be closed on Friday for the festival." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} aria-label="Message" />
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted">Colour
            <select className="input mt-1 w-auto" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
              <option value="INFO">Blue – information</option>
              <option value="WARNING">Amber – warning</option>
              <option value="SUCCESS">Green – good news</option>
            </select>
          </label>
          <label className="text-xs text-muted">Hide automatically after (optional)
            <input type="datetime-local" className="input mt-1 w-auto" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </label>
          <button className="btn-primary ml-auto" disabled={saving}>{saving ? <Spinner className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />} Post announcement</button>
        </div>
        {form.message && (
          <div className={`${LEVELS[form.level]} rounded-xl px-4 py-2 text-sm font-medium text-white`}>Preview: {form.message}</div>
        )}
      </form>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements yet" />
      ) : (
        <div className="space-y-2">
          {data.map((a) => (
            <div key={a.id} className={`card flex items-center gap-3 p-4 ${a.active ? '' : 'opacity-50'}`}>
              <span className={`h-3 w-3 shrink-0 rounded-full ${LEVELS[a.level]}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.message}</p>
                <p className="text-xs text-muted">
                  {dateTime(a.createdAt)} · {a.active ? (a.expiresAt ? `visible until ${dateTime(a.expiresAt)}` : 'visible') : 'hidden'}
                </p>
              </div>
              {a.active && (
                <button className="btn-ghost p-2 text-red-600" onClick={() => remove(a)} aria-label="Remove announcement">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
