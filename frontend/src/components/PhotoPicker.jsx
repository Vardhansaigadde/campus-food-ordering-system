import { useRef, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../lib/api'
import { shrinkPhoto } from '../lib/photos'
import { FoodImage, Spinner } from './ui'

/**
 * "Add photo" for dishes and canteens: take a picture or pick one from the gallery.
 * The photo is shrunk on the phone, uploaded to `uploadPath`, and its address passed to `onChange`.
 */
export default function PhotoPicker({ id, value, onChange, uploadPath, alt, kind = 'dish' }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // picking the same photo again must still trigger a change
    if (!file) return
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', await shrinkPhoto(file))
      const { data } = await api.post(uploadPath, body)
      onChange(data.url)
    } catch (err) {
      toast.error(err.response ? errorMessage(err) : err.message || 'Could not add the photo. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl">
        <FoodImage src={value} alt={alt} kind={kind} className="h-full w-full" />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white" role="status" aria-label="Uploading photo">
            <Spinner className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={input} id={id} type="file" accept="image/*" className="sr-only" onChange={pick} disabled={busy} />
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
          <Camera className="h-4 w-4" /> {busy ? 'Uploading…' : value ? 'Change photo' : 'Add photo'}
        </button>
        {value && !busy && (
          <button type="button" className="btn-ghost text-red-600 dark:text-red-400" onClick={() => onChange('')} aria-label="Remove photo">
            <Trash2 className="h-4 w-4" /> Remove
          </button>
        )}
      </div>
    </div>
  )
}
