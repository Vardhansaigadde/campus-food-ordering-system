import { useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, ListChecks, Pencil, Plus, RotateCcw, Store, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { ADMIN_BASE } from '../../config'
import { EmptyState, ErrorBox, Modal, PageHeader, PageLoader, Rating, RestaurantStatusBadge, Spinner } from '../../components/ui'
import PhotoPicker from '../../components/PhotoPicker'

const blank = {
  name: '', code: '', location: '', description: '', imageUrl: '', openingHours: '', autoCloseTime: '',
  loginEmail: '', loginPassword: '',
}

export default function Restaurants() {
  const { data, setData, loading, error, reload } = useApi(() => api.get('/admin/restaurants').then((r) => r.data), [])
  const [form, setForm] = useState(null)
  const [loginFor, setLoginFor] = useState(null)
  const [saving, setSaving] = useState(false)

  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const replace = (r) => setData((list) => list.map((x) => (x.id === r.id ? r : x)))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const body = { ...form, autoCloseTime: form.autoCloseTime ? `${form.autoCloseTime.slice(0, 5)}:00` : null }
    try {
      if (form.id) {
        replace((await api.put(`/admin/restaurants/${form.id}`, body)).data)
        toast.success('Restaurant updated')
      } else {
        const { data: created } = await api.post('/admin/restaurants', body)
        setData((list) => [created, ...list])
        toast.success(`${created.name} added. Staff can log in with ${form.loginEmail}`)
      }
      setForm(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (r, status) => {
    try {
      replace((await api.patch(`/admin/restaurants/${r.id}/status`, { status, busyMinutes: status === 'BUSY' ? 15 : null })).data)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const removeOrRestore = async (r) => {
    if (r.active && !confirm(`Remove ${r.name}? Students will no longer see it and its staff logins are blocked. Order history is kept.`)) return
    try {
      const { data: updated } = r.active ? await api.delete(`/admin/restaurants/${r.id}`) : await api.post(`/admin/restaurants/${r.id}/restore`)
      replace(updated)
      toast.success(r.active ? `${r.name} removed` : `${r.name} restored`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const addLogin = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/admin/restaurants/${loginFor.restaurant.id}/logins`, loginFor.form)
      toast.success(`Login ${loginFor.form.email} created`)
      setLoginFor(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const f = (field) => ({ value: form[field] ?? '', onChange: (e) => setForm({ ...form, [field]: e.target.value }) })

  return (
    <>
      <PageHeader title="Restaurants" subtitle="Canteens, logins and status." actions={<button className="btn-primary" onClick={() => setForm(blank)}><Plus className="h-4 w-4" /> Add restaurant</button>} />

      {data.length === 0 ? (
        <EmptyState icon={Store} title="No restaurants yet" text="Add the first canteen to get started." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.map((r) => (
            <div key={r.id} className={`card p-5 ${r.active ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">{r.name}</h3>
                    <span className="chip bg-slate-100 font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">{r.code}</span>
                    {!r.active && <span className="chip bg-red-100 text-red-700">Removed</span>}
                  </div>
                  <p className="text-sm text-muted">{[r.location, r.openingHours].filter(Boolean).join(' · ')}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                    <span>{r.dishesToday} dishes today</span>
                    <Rating value={r.rating} count={r.ratingCount} />
                  </div>
                </div>
                <RestaurantStatusBadge status={r.status} />
              </div>
              {r.active && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                    {['OPEN', 'BUSY', 'CLOSED'].map((s) => (
                      <button key={s} onClick={() => setStatus(r, s)} className={`min-h-9 rounded-lg px-3 py-1 text-xs font-bold ${r.status === s ? 'bg-white shadow dark:bg-slate-900' : 'text-muted'}`}>{s}</button>
                    ))}
                  </div>
                  <Link to={`${ADMIN_BASE}/restaurants/${r.id}`} className="btn-secondary py-1.5"><ListChecks className="h-4 w-4" /> Dishes</Link>
                  <button className="btn-secondary py-1.5" onClick={() => setForm({ ...blank, ...r, autoCloseTime: r.autoCloseTime ?? '' })}><Pencil className="h-4 w-4" /> Edit</button>
                  <button className="btn-secondary py-1.5" onClick={() => setLoginFor({ restaurant: r, form: { name: `${r.name} Staff`, email: '', password: '' } })}><KeyRound className="h-4 w-4" /> Add login</button>
                </div>
              )}
              <button className={`btn-ghost mt-2 px-2 py-1.5 text-xs ${r.active ? 'text-red-600' : 'text-emerald-600'}`} onClick={() => removeOrRestore(r)}>
                {r.active ? <><Trash2 className="h-3.5 w-3.5" /> Remove restaurant</> : <><RotateCcw className="h-3.5 w-3.5" /> Restore restaurant</>}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? `Edit ${form.name}` : 'Add a restaurant'} wide>
        {form && (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="r-name">Name</label>
                <input id="r-name" required maxLength={80} className="input" placeholder="Main Canteen" {...f('name')} />
              </div>
              <div>
                <label className="label" htmlFor="r-code">Token code</label>
                <input id="r-code" required disabled={!!form.id} pattern="[A-Za-z]{2,4}" maxLength={4} className="input uppercase" placeholder="MC" {...f('code')} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="r-loc">Location</label>
              <input id="r-loc" maxLength={120} className="input" placeholder="Block A, ground floor" {...f('location')} />
            </div>
            <div>
              <label className="label" htmlFor="r-hours">Opening hours</label>
              <input id="r-hours" maxLength={60} className="input" placeholder="8:00 AM – 8:00 PM" {...f('openingHours')} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="r-desc">Description</label>
              <input id="r-desc" maxLength={300} className="input" placeholder="South Indian meals, snacks and beverages" {...f('description')} />
            </div>
            <div>
              <label className="label" htmlFor="r-img">Photo</label>
              <PhotoPicker id="r-img" kind="restaurant" value={form.imageUrl} onChange={(url) => setForm((r) => ({ ...r, imageUrl: url }))} uploadPath="/admin/restaurants/photos" alt={form.name} />
            </div>
            <div>
              <label className="label" htmlFor="r-close">Auto-close time</label>
              <input id="r-close" type="time" className="input" {...f('autoCloseTime')} />
            </div>
            {!form.id && (
              <div className="sm:col-span-2 grid gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50 sm:grid-cols-2">
                <p className="sm:col-span-2 text-sm font-semibold">Staff login for this restaurant</p>
                <input required type="email" className="input" placeholder="staff email" aria-label="Staff login email" {...f('loginEmail')} />
                <input required minLength={6} type="text" className="input" placeholder="initial password" aria-label="Staff initial password" {...f('loginPassword')} />
              </div>
            )}
            <button className="btn-primary sm:col-span-2" disabled={saving}>{saving && <Spinner className="h-4 w-4" />} {form.id ? 'Save changes' : 'Create restaurant'}</button>
          </form>
        )}
      </Modal>

      <Modal open={!!loginFor} onClose={() => setLoginFor(null)} title={`New login for ${loginFor?.restaurant.name ?? ''}`}>
        {loginFor && (
          <form onSubmit={addLogin} className="space-y-3">
            <input required maxLength={80} className="input" placeholder="Name" aria-label="Name" value={loginFor.form.name} onChange={(e) => setLoginFor({ ...loginFor, form: { ...loginFor.form, name: e.target.value } })} />
            <input required type="email" className="input" placeholder="Email" aria-label="Email" value={loginFor.form.email} onChange={(e) => setLoginFor({ ...loginFor, form: { ...loginFor.form, email: e.target.value } })} />
            <input required minLength={6} className="input" placeholder="Initial password" aria-label="Initial password" value={loginFor.form.password} onChange={(e) => setLoginFor({ ...loginFor, form: { ...loginFor.form, password: e.target.value } })} />
            <button className="btn-primary w-full" disabled={saving}>{saving && <Spinner className="h-4 w-4" />} Create login</button>
          </form>
        )}
      </Modal>
    </>
  )
}
