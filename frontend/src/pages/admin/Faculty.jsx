import { useEffect, useState } from 'react'
import { BadgeCheck, Building2, Check, Eye, EyeOff, IdCard, Pencil, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { dateTime } from '../../lib/format'
import { useLiveEvent } from '../../context/LiveContext'
import { EmptyState, ErrorBox, Modal, PageHeader, PageLoader, Spinner } from '../../components/ui'

/** The ID photo is private: fetched with the admin's login, never as a public link. */
function IdPhoto({ userId, name }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let objectUrl
    api.get(`/admin/users/${userId}/faculty-id-photo`, { responseType: 'blob' })
      .then((r) => setUrl((objectUrl = URL.createObjectURL(r.data))))
      .catch(() => setFailed(true))
    return () => objectUrl && URL.revokeObjectURL(objectUrl)
  }, [userId])
  if (failed) return <div className="flex h-44 items-center justify-center rounded-2xl bg-slate-100 text-sm text-muted dark:bg-slate-800">No ID photo</div>
  if (!url) return <div className="h-44 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Open full size">
      <img src={url} alt={`College ID of ${name}`} className="h-44 w-full rounded-2xl bg-slate-100 object-contain dark:bg-slate-800" />
    </a>
  )
}

function Requests({ places }) {
  const { data, setData, loading, error, reload } = useApi(() => api.get('/admin/users/faculty-requests').then((r) => r.data), [])
  useLiveEvent(['FACULTY_REQUEST'], () => reload({ silent: true }))
  const [busy, setBusy] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')

  const decide = async (r, action, body) => {
    setBusy(r.userId)
    try {
      await api.post(`/admin/users/${r.userId}/faculty/${action}`, body)
      setData((list) => list.filter((x) => x.userId !== r.userId))
      toast.success(action === 'approve' ? `${r.name} can now order delivery` : `${r.name}'s request was rejected`)
      setRejecting(null)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><IdCard className="h-5 w-5 text-brand" /> Waiting for approval ({data.length})</h2>
      {!data.length ? (
        <EmptyState icon={BadgeCheck} title="No requests" text="New requests appear here." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((r) => (
            <div key={r.userId} className="card space-y-3 p-4">
              <IdPhoto userId={r.userId} name={r.name} />
              <div>
                <p className="text-lg font-bold">{r.name}</p>
                <p className="text-sm text-muted">{r.email}{r.phone ? ` · ${r.phone}` : ''}</p>
                <p className="mt-1 text-sm">
                  <b>{r.department}</b> · {places[r.deliveryLocationId] ?? 'Unknown building'}, {r.deliveryRoom}
                </p>
                <p className="text-xs text-muted">Sent {dateTime(r.requestedAt)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-success" disabled={busy === r.userId} onClick={() => decide(r, 'approve')}>
                  {busy === r.userId ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />} Approve
                </button>
                <button className="btn-secondary text-red-600" disabled={busy === r.userId} onClick={() => { setRejecting(r); setReason('') }}>
                  <X className="h-4 w-4" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title={`Reject ${rejecting?.name ?? ''}?`}>
        <label className="label" htmlFor="reject-reason">Reason (shown to them)</label>
        <input id="reject-reason" className="input" maxLength={150} placeholder="e.g. ID photo is not clear – please send again" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn-danger mt-4 w-full" disabled={busy === rejecting?.userId} onClick={() => decide(rejecting, 'reject', { reason: reason.trim() || null })}>
          Reject request
        </button>
      </Modal>
    </section>
  )
}

function Places({ data, setData }) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  const add = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data: created } = await api.post('/admin/locations', { name: name.trim() })
      setData((list) => [...list, created].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const save = async (place, changes) => {
    try {
      const { data: saved } = await api.put(`/admin/locations/${place.id}`, { name: place.name, active: place.active, ...changes })
      setData((list) => list.map((p) => (p.id === saved.id ? saved : p)))
      setEditing(null)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><Building2 className="h-5 w-5 text-brand" /> Delivery places</h2>
      <p className="mb-3 text-sm text-muted">Buildings food can be delivered to.</p>
      <form onSubmit={add} className="mb-3 flex gap-2">
        <input required maxLength={60} className="input" placeholder="e.g. CSE Block" value={name} onChange={(e) => setName(e.target.value)} aria-label="New delivery place" />
        <button className="btn-primary shrink-0" disabled={busy}><Plus className="h-4 w-4" /> Add</button>
      </form>
      <div className="card divide-y divide-line dark:divide-slate-800">
        {!data.length && <p className="p-4 text-sm text-muted">No places yet – add the buildings on campus.</p>}
        {data.map((p) => (
          <div key={p.id} className="flex items-center gap-2 p-3">
            {editing?.id === p.id ? (
              <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); save(p, { name: editing.name.trim() }) }}>
                <input autoFocus required maxLength={60} className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Place name" />
                <button className="btn-primary shrink-0">Save</button>
              </form>
            ) : (
              <>
                <span className={`flex-1 font-medium ${p.active ? '' : 'text-muted line-through'}`}>{p.name}</span>
                <button className="btn-ghost" onClick={() => setEditing({ id: p.id, name: p.name })} aria-label={`Rename ${p.name}`}><Pencil className="h-4 w-4" /></button>
                <button className="btn-ghost" onClick={() => save(p, { active: !p.active })} aria-label={p.active ? `Hide ${p.name}` : `Show ${p.name}`} title={p.active ? 'Hide from new orders' : 'Show again'}>
                  {p.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Faculty() {
  const { data: places, setData: setPlaces, loading, error, reload } = useApi(() => api.get('/admin/locations').then((r) => r.data), [])
  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const names = Object.fromEntries(places.map((p) => [p.id, p.name]))
  return (
    <>
      <PageHeader title="Faculty delivery" subtitle="Faculty approvals and delivery places." />
      <Requests places={names} />
      <Places data={places} setData={setPlaces} />
    </>
  )
}
