import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, KeyRound, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { date } from '../../lib/format'
import { PageHeader, PageLoader, Spinner } from '../../components/ui'
import HeaderTools from '../../components/HeaderTools'
import FacultyCard from '../../components/FacultyCard'

export function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/auth/change-password', form)
      toast.success('Password changed')
      setForm({ currentPassword: '', newPassword: '' })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-5 w-5 text-brand" /> Change password</h2>
      <input type="password" required autoComplete="current-password" placeholder="Current password" className="input" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} aria-label="Current password" />
      <input type="password" required minLength={6} autoComplete="new-password" placeholder="New password (min 6 characters)" className="input" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} aria-label="New password" />
      <button className="btn-primary" disabled={saving}>{saving && <Spinner className="h-4 w-4" />} Update password</button>
    </form>
  )
}

export default function Account() {
  const { data: me, setData, loading } = useApi(() => api.get('/auth/me').then((r) => r.data), [])
  const location = useLocation()
  if (loading || !me) return <PageLoader />
  const banned = me.orderBanUntil && new Date(me.orderBanUntil) > new Date()

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="My account" />
      <div className="card flex items-center gap-4 p-5">
        <div className="rounded-full bg-brand-50 p-3 text-brand dark:bg-brand-500/10"><UserRound className="h-7 w-7" /></div>
        <div>
          <p className="text-lg font-semibold">{me.name}</p>
          <p className="text-sm text-muted">{me.email}{me.phone ? ` · ${me.phone}` : ''}</p>
          <p className="text-xs text-muted">Member since {date(me.createdAt)}</p>
        </div>
      </div>
      <div className={`card p-5 ${banned ? 'border-red-300 dark:border-red-500/40' : ''}`}>
        <h2 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5 text-amber-500" /> Pickup record</h2>
        {banned ? (
          <p className="mt-2 text-sm text-red-600">Ordering is paused until {date(me.orderBanUntil)} because 3 orders were not collected.</p>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Uncollected orders: <b>{me.noShowCount}</b> of 3. Orders not collected within 3 hours of being ready count as
            no-shows; 3 no-shows pause ordering for 7 days.
          </p>
        )}
      </div>
      <div className="card flex items-center justify-between gap-3 p-5 sm:hidden">
        <div>
          <h2 className="font-semibold">App settings</h2>
          <p className="text-sm text-muted">Live status, alerts, dark mode, log out</p>
        </div>
        <HeaderTools />
      </div>
      <FacultyCard me={me} onChange={setData} startOpen={Boolean(location.state?.faculty)} />
      <ChangePassword />
    </div>
  )
}
