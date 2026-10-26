import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Bike, Camera, Clock, IdCard, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../lib/api'
import { useApi } from '../lib/useApi'
import { shrinkPhoto } from '../lib/photos'
import { Spinner } from './ui'

/** Building + room, used both in the request form and to change the delivery place later. */
function PlaceFields({ locations, value, onChange }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="label">Building</span>
        <select required className="input" value={value.deliveryLocationId} onChange={(e) => onChange({ ...value, deliveryLocationId: e.target.value })}>
          <option value="">Choose…</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Room</span>
        <input required maxLength={30} className="input" placeholder="e.g. 204 or Staff room" value={value.deliveryRoom} onChange={(e) => onChange({ ...value, deliveryRoom: e.target.value })} />
      </label>
    </div>
  )
}

/**
 * "I am faculty" on the account page: send department, delivery place and a college ID photo;
 * the admin approves it, and then food can be delivered to the room.
 */
export default function FacultyCard({ me, onChange, startOpen = false }) {
  const { data: locations } = useApi(() => api.get('/locations').then((r) => r.data), [])
  const status = me.facultyStatus ?? 'NONE'
  const canRequest = status === 'NONE' || status === 'NOT_VERIFIED' || status === 'REJECTED'
  const [open, setOpen] = useState((startOpen && canRequest) || status === 'NOT_VERIFIED')
  const [editingPlace, setEditingPlace] = useState(false)
  const [form, setForm] = useState({
    department: me.department ?? '',
    deliveryLocationId: me.deliveryLocationId ? String(me.deliveryLocationId) : '',
    deliveryRoom: me.deliveryRoom ?? '',
  })
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const card = useRef(null)
  const fileInput = useRef(null)

  useEffect(() => {
    if (startOpen) card.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [startOpen])
  // Free the preview image when it changes or the card goes away
  useEffect(() => () => photo && URL.revokeObjectURL(photo.preview), [photo])

  const startRequest = async () => {
    setOpen(true)
    if (status === 'NONE') {
      // Remember it, so the reminder shows until they send the ID
      const { data } = await api.post('/auth/faculty/intent').catch(() => ({ data: null }))
      if (data) onChange(data)
    }
  }

  const notFaculty = async () => {
    setOpen(false)
    if (status === 'NOT_VERIFIED') {
      const { data } = await api.delete('/auth/faculty/intent').catch(() => ({ data: null }))
      if (data) onChange(data)
    }
  }

  const placeName = locations?.find((l) => l.id === me.deliveryLocationId)?.name ?? 'your building'

  const pickPhoto = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setPhoto({ file, preview: URL.createObjectURL(file) })
  }

  const sendRequest = async (e) => {
    e.preventDefault()
    if (!photo) return toast.error('Add a photo of your college ID card')
    setBusy(true)
    try {
      const body = new FormData()
      body.append('department', form.department.trim())
      body.append('deliveryLocationId', form.deliveryLocationId)
      body.append('deliveryRoom', form.deliveryRoom.trim())
      body.append('idPhoto', await shrinkPhoto(photo.file, 1400))
      const { data } = await api.post('/auth/faculty', body)
      onChange(data)
      setOpen(false)
      setPhoto(null)
      toast.success('Sent! The canteen office will check your ID soon.')
    } catch (err) {
      toast.error(err.response ? errorMessage(err) : err.message)
    } finally {
      setBusy(false)
    }
  }

  const savePlace = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const { data } = await api.put('/auth/faculty/place', {
        deliveryLocationId: Number(form.deliveryLocationId),
        deliveryRoom: form.deliveryRoom.trim(),
      })
      onChange(data)
      setEditingPlace(false)
      toast.success('Delivery place updated')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const placeForm = (
    <form onSubmit={savePlace} className="mt-3 space-y-3">
      <PlaceFields locations={locations ?? []} value={form} onChange={setForm} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Save</button>
        <button type="button" className="btn-ghost" onClick={() => setEditingPlace(false)}>Cancel</button>
      </div>
    </form>
  )

  return (
    <div ref={card} className="card p-5" id="faculty">
      <h2 className="flex items-center gap-2 font-semibold"><Bike className="h-5 w-5 text-brand" /> Faculty delivery</h2>

      {status === 'APPROVED' && (
        <>
          <p className="mt-2 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <BadgeCheck className="h-4 w-4" /> You're approved. Choose <b>Delivery</b> in your cart.
          </p>
          <p className="mt-1 text-sm text-muted">Delivered to <b className="text-slate-700 dark:text-slate-200">{placeName}, {me.deliveryRoom}</b> by default.</p>
          {editingPlace ? placeForm : <button className="btn-secondary mt-3" onClick={() => setEditingPlace(true)}>Change building / room</button>}
        </>
      )}

      {status === 'PENDING' && (
        <>
          <p className="mt-2 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Clock className="h-4 w-4" /> Waiting for the canteen office to check your ID.
          </p>
          {editingPlace ? placeForm : <button className="btn-ghost mt-2 px-0 text-brand" onClick={() => setEditingPlace(true)}>Change building / room</button>}
        </>
      )}

      {canRequest && (
        <>
          {status === 'REJECTED' && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> Not approved{me.facultyNote ? `: ${me.facultyNote}` : '.'} You can send a new request.
            </p>
          )}
          {!open ? (
            <>
              <p className="mt-2 text-sm text-muted">Get food delivered to your room. Verify once with your college ID.</p>
              <button className="btn-primary mt-3" onClick={startRequest}>I am faculty</button>
            </>
          ) : (
            <form onSubmit={sendRequest} className="mt-3 space-y-3">
              <label className="block">
                <span className="label">Department</span>
                <input required maxLength={60} className="input" placeholder="e.g. CSE" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </label>
              <PlaceFields locations={locations ?? []} value={form} onChange={setForm} />
              <div>
                <span className="label">College ID card photo</span>
                <input ref={fileInput} type="file" accept="image/*" className="sr-only" onChange={pickPhoto} aria-label="College ID card photo" />
                <div className="flex items-center gap-3">
                  {photo ? (
                    <img src={photo.preview} alt="Your ID card" className="h-20 w-32 rounded-xl border border-line object-cover dark:border-slate-700" />
                  ) : (
                    <div className="flex h-20 w-32 items-center justify-center rounded-xl border border-dashed border-line-strong text-muted dark:border-slate-600">
                      <IdCard className="h-7 w-7" />
                    </div>
                  )}
                  <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
                    <Camera className="h-4 w-4" /> {photo ? 'Change photo' : 'Add photo'}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-muted">Private – deleted after review.</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Send for approval</button>
                <button type="button" className="btn-ghost" onClick={notFaculty}>
                  {status === 'NOT_VERIFIED' ? "I'm not faculty" : 'Cancel'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  )
}
