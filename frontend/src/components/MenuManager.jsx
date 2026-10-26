import { useMemo, useState } from 'react'
import { CalendarCheck, Copy, Pencil, Plus, Power, PowerOff, Search, Trash2, UtensilsCrossed } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../lib/api'
import { useApi } from '../lib/useApi'
import { money } from '../lib/format'
import { EmptyState, ErrorBox, FoodImage, Modal, PageLoader, Rating, Spinner, Toggle, VegMark } from './ui'
import PhotoPicker from './PhotoPicker'

const CATEGORIES = ['Breakfast', 'Main Course', 'Rice & Biryani', 'Snacks', 'Chinese', 'South Indian', 'North Indian', 'Beverages', 'Desserts']

const emptyDish = { name: '', description: '', price: '', category: 'Main Course', veg: true, imageUrl: '', dailyStock: '', special: false, readyMade: false }

/**
 * Full menu + today's availability. Used by restaurant staff (own restaurant) and by the admin
 * (any restaurant) – only the API paths differ.
 *
 * paths: { list, create, item(id), availability(id), stock(id)?, all, copy? }
 */
export default function MenuManager({ paths }) {
  const { data, setData, loading, error, reload } = useApi(() => api.get(paths.list).then((r) => r.data), [paths.list])
  const [editing, setEditing] = useState(null) // dish object or emptyDish
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState(null)

  const grouped = useMemo(() => {
    const list = (data ?? []).filter((d) => !search || d.name.toLowerCase().includes(search.toLowerCase()))
    const map = new Map()
    for (const d of list) map.set(d.category, [...(map.get(d.category) ?? []), d])
    return [...map.entries()]
  }, [data, search])

  if (loading) return <PageLoader />
  if (error) return <ErrorBox message={error} onRetry={reload} />

  const availableCount = data.filter((d) => d.availableToday).length

  const replace = (dish) => setData((list) => list.map((d) => (d.id === dish.id ? dish : d)))

  const toggle = async (dish, available) => {
    setBusyId(dish.id)
    try {
      const { data: updated } = await api.patch(paths.availability(dish.id), { available, stockLeft: null })
      replace(updated)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  const saveStock = async (dish, value) => {
    if (!paths.stock) return
    const stockLeft = value === '' ? null : Number(value)
    if (stockLeft === dish.stockLeft) return
    try {
      const { data: updated } = await api.patch(paths.stock(dish.id), { stockLeft })
      replace(updated)
      toast.success(`${dish.name}: ${stockLeft == null ? 'no limit' : `${stockLeft} plates left`}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const bulk = async (url, body, message) => {
    try {
      const { data: res } = await api.post(url, body)
      toast.success(message(res.updated))
      reload({ silent: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const body = {
      ...editing,
      price: Number(editing.price),
      dailyStock: editing.dailyStock === '' || editing.dailyStock == null ? null : Number(editing.dailyStock),
    }
    try {
      if (editing.id) {
        replace((await api.put(paths.item(editing.id), body)).data)
        toast.success('Dish updated')
      } else {
        const { data: created } = await api.post(paths.create, body)
        setData((list) => [...list, created])
        toast.success(`${created.name} added. Switch it on to sell it today.`)
      }
      setEditing(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (dish) => {
    if (!confirm(`Delete ${dish.name} from the menu?`)) return
    try {
      await api.delete(paths.item(dish.id))
      setData((list) => list.filter((d) => d.id !== dish.id))
      setEditing(null)
      toast.success('Dish deleted')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4 sm:col-span-1">
          <CalendarCheck className="h-8 w-8 text-emerald-500" />
          <div>
            <p className="text-2xl font-black">{availableCount} <span className="text-base font-medium text-muted">/ {data.length}</span></p>
            <p className="text-xs text-muted">dishes on today's menu</p>
          </div>
        </div>
        <div className={`grid gap-2 sm:col-span-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end ${paths.copy ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <button className="btn-primary col-span-full sm:order-last" onClick={() => setEditing(emptyDish)}>
            <Plus className="h-4 w-4" /> Add dish
          </button>
          {paths.copy && (
            <button className="btn-secondary px-2 sm:px-4" onClick={() => bulk(paths.copy, {}, (n) => `Today's menu set to the last day's ${n} dishes`)}>
              <Copy className="h-4 w-4 shrink-0" /> Same as last day
            </button>
          )}
          <button className="btn-secondary px-2 sm:px-4" onClick={() => bulk(paths.all, { available: true }, (n) => `All ${n} dishes are on today's menu`)}>
            <Power className="h-4 w-4 shrink-0 text-emerald-600" /> All on
          </button>
          <button className="btn-secondary px-2 sm:px-4" onClick={() => bulk(paths.all, { available: false }, () => 'All dishes switched off for today')}>
            <PowerOff className="h-4 w-4 shrink-0 text-red-600" /> All off
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input className="input pl-9" placeholder="Search dishes" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search dishes" />
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No dishes yet"
          text="Add your dishes once."
          action={<button className="btn-primary" onClick={() => setEditing(emptyDish)}><Plus className="h-4 w-4" /> Add first dish</button>}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, dishes]) => (
            <section key={category}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{category}</h2>
              <div className="card divide-y divide-slate-100 dark:divide-slate-800">
                {dishes.map((d) => (
                  <div key={d.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 p-3 sm:flex-nowrap ${d.availableToday ? '' : 'opacity-70'}`}>
                    <FoodImage src={d.imageUrl} alt={d.name} className="h-12 w-12 shrink-0 rounded-lg text-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-semibold">
                        <VegMark veg={d.veg} /> <span className="truncate">{d.name}</span>
                        {d.special && <span className="chip bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">Special</span>}
                        {d.bestseller && <span className="chip hidden bg-brand-100 text-brand-700 sm:inline-flex dark:bg-brand-500/15 dark:text-brand-300">Bestseller</span>}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
                        {money(d.price)} · {d.readyMade ? 'Ready-made' : 'Made fresh'} · sold {d.soldCount} <Rating value={d.rating} count={d.ratingCount} />
                      </p>
                    </div>
                    {/* On/off: first line on phones, last item on wide screens */}
                    <div className="flex items-center gap-2 sm:order-last">
                      <span className={`text-xs font-semibold ${d.availableToday ? 'text-emerald-600' : 'text-muted'}`}>
                        {d.availableToday ? 'On' : d.stockLeft === 0 ? 'Sold out' : 'Off'}
                      </span>
                      {busyId === d.id ? (
                        <span className="flex h-7 w-12 items-center justify-center"><Spinner className="h-5 w-5 text-brand" /></span>
                      ) : (
                        <Toggle checked={d.availableToday} onChange={(v) => toggle(d, v)} label={`${d.name} available today`} />
                      )}
                    </div>
                    {/* Second line on phones */}
                    <div className="flex basis-full items-center justify-end gap-2 sm:basis-auto">
                      {paths.stock && d.availableToday && (
                        <label className="mr-auto flex items-center gap-2 text-sm text-muted sm:mr-0 sm:text-xs">
                          Plates left
                          <input
                            key={`${d.id}-${d.stockLeft}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={1000}
                            placeholder="∞"
                            defaultValue={d.stockLeft ?? ''}
                            onBlur={(e) => saveStock(d, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            className={`input w-20 py-1.5 text-center ${d.stockLeft === 0 ? 'border-red-400 text-red-600' : ''}`}
                          />
                        </label>
                      )}
                      <button className="btn-ghost px-3" onClick={() => setEditing({ ...d, dailyStock: d.dailyStock ?? '', imageUrl: d.imageUrl ?? '', description: d.description ?? '' })} aria-label={`Edit ${d.name}`}>
                        <Pencil className="h-4 w-4" /> <span className="sm:hidden">Edit</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit dish' : 'Add a dish'}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="label" htmlFor="dish-name">Name</label>
              <input id="dish-name" required maxLength={80} className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="dish-price">Price (₹)</label>
                <input id="dish-price" required type="number" min={1} max={5000} step="0.5" className="input" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="dish-category">Category</label>
                <input id="dish-category" required list="categories" maxLength={40} className="input" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} />
                <datalist id="categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="dish-desc">Description <span className="font-normal text-muted">(optional)</span></label>
              <textarea id="dish-desc" rows={2} maxLength={300} className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="dish-img">Photo <span className="font-normal text-muted">(optional)</span></label>
              <PhotoPicker id="dish-img" value={editing.imageUrl} onChange={(url) => setEditing((d) => ({ ...d, imageUrl: url }))} uploadPath={paths.photos} alt={editing.name} />
            </div>
            <div>
              <label className="label" htmlFor="dish-stock">Usual plates for app orders per day <span className="font-normal text-muted">(empty = no limit)</span></label>
              <input id="dish-stock" type="number" min={1} max={1000} className="input" value={editing.dailyStock} onChange={(e) => setEditing({ ...editing, dailyStock: e.target.value })} />
              <p className="mt-1 text-xs text-muted">At 0 it shows "Sold out".</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-slate-200 p-3 dark:border-slate-700">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-600" checked={editing.readyMade} onChange={(e) => setEditing({ ...editing, readyMade: e.target.checked })} />
              <span>
                <span className="block text-sm font-semibold">Ready-made (cooked in advance, e.g. biryani)</span>
                <span className="block text-xs text-muted">Orders are confirmed instantly.</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="veg" checked={editing.veg} onChange={() => setEditing({ ...editing, veg: true })} className="accent-emerald-600" /> <VegMark veg /> Veg
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="veg" checked={!editing.veg} onChange={() => setEditing({ ...editing, veg: false })} className="accent-red-600" /> <VegMark veg={false} /> Non-veg
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.special} onChange={(e) => setEditing({ ...editing, special: e.target.checked })} className="accent-purple-600" /> Today's Special
              </label>
            </div>
            <button className="btn-primary w-full" disabled={saving}>{saving && <Spinner className="h-4 w-4" />} {editing.id ? 'Save changes' : 'Add dish'}</button>
            {editing.id && (
              <button type="button" className="btn-ghost w-full text-red-600 dark:text-red-400" onClick={() => remove(editing)}>
                <Trash2 className="h-4 w-4" /> Delete this dish
              </button>
            )}
          </form>
        )}
      </Modal>
    </>
  )
}
