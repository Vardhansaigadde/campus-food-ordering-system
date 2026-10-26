import { useEffect, useState } from 'react'
import { Ban, KeyRound, Search, ShieldCheck, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, errorMessage } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { date } from '../../lib/format'
import { ErrorBox, Modal, PageHeader, PageLoader, Spinner } from '../../components/ui'

/** Calls one admin action and puts the updated user back into the list. */
function userAction(onChange) {
  return async (url, body, message) => {
    try {
      const { data } = await (body === undefined ? api.post(url) : api.patch(url, body))
      onChange(data)
      toast.success(message)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
}

/** Clear ban / Password / Block – shared by the table row (wide screens) and the card (phones). */
function UserActions({ u, banned, act, onPassword }) {
  return (
    <>
      {banned && (
        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => act(`/admin/users/${u.id}/clear-ban`, undefined, 'Ban cleared')}>
          <ShieldCheck className="h-4 w-4" /> Clear ban
        </button>
      )}
      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => onPassword(u)}><KeyRound className="h-4 w-4" /> Password</button>
      <button
        className={`btn-ghost px-2 py-1 text-xs ${u.blocked ? 'text-emerald-600' : 'text-red-600'}`}
        onClick={() => act(`/admin/users/${u.id}/block`, { blocked: !u.blocked }, u.blocked ? 'User unblocked' : 'User blocked')}
      >
        <Ban className="h-4 w-4" /> {u.blocked ? 'Unblock' : 'Block'}
      </button>
    </>
  )
}

function UserCard({ u, onChange, onPassword }) {
  const banned = u.orderBanUntil && new Date(u.orderBanUntil) > new Date()
  const act = userAction(onChange)
  return (
    <li className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{u.name}</p>
          <p className="break-all text-xs text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
        </div>
        <span className="chip shrink-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{u.role}</span>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
        Joined {date(u.createdAt)}
        {u.blocked && <span className="chip bg-red-100 text-red-700">Blocked</span>}
        {banned && <span className="chip bg-amber-100 text-amber-700">Ban till {date(u.orderBanUntil)}</span>}
        {u.totalNoShows > 0 && <span>· {u.totalNoShows} no-shows</span>}
      </p>
      <div className="mt-2 flex flex-wrap justify-end gap-1">
        <UserActions u={u} banned={banned} act={act} onPassword={onPassword} />
      </div>
    </li>
  )
}

function UserRow({ u, onChange, onPassword }) {
  const banned = u.orderBanUntil && new Date(u.orderBanUntil) > new Date()
  const act = userAction(onChange)
  return (
    <tr>
      <td className="px-4 py-2.5">
        <p className="font-semibold">{u.name}</p>
        <p className="text-xs text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
      </td>
      <td className="px-4 py-2.5"><span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{u.role}</span></td>
      <td className="px-4 py-2.5 text-xs text-muted">{date(u.createdAt)}</td>
      <td className="px-4 py-2.5 text-xs">
        {u.blocked && <span className="chip mr-1 bg-red-100 text-red-700">Blocked</span>}
        {banned && <span className="chip mr-1 bg-amber-100 text-amber-700">Ban till {date(u.orderBanUntil)}</span>}
        {u.totalNoShows > 0 && <span className="text-muted">{u.totalNoShows} no-shows</span>}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex justify-end gap-1">
          <UserActions u={u} banned={banned} act={act} onPassword={onPassword} />
        </div>
      </td>
    </tr>
  )
}

export default function Users() {
  const [tab, setTab] = useState('all')
  const [role, setRole] = useState('')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pwFor, setPwFor] = useState(null)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(q)
      setPage(0)
    }, 300)
    return () => clearTimeout(id)
  }, [q])

  const list = useApi(
    () => (tab === 'all'
      ? api.get('/admin/users', { params: { role: role || undefined, q: query || undefined, page, size: 20 } }).then((r) => r.data)
      : api.get('/admin/users/no-shows').then((r) => ({ content: r.data, totalPages: 1, totalElements: r.data.length }))),
    [tab, role, query, page],
  )

  const onChange = (u) => list.setData((d) => ({ ...d, content: d.content.map((x) => (x.id === u.id ? u : x)) }))

  const resetPassword = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post(`/admin/users/${pwFor.id}/reset-password`, { password })
      toast.success(`Password reset for ${pwFor.name}`)
      setPwFor(null)
      setPassword('')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Users" subtitle="Students and restaurant staff." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full bg-slate-200/70 p-1 dark:bg-slate-800">
          <button onClick={() => { setTab('all'); setPage(0) }} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === 'all' ? 'bg-white shadow dark:bg-slate-900' : 'text-muted'}`}>All users</button>
          <button onClick={() => setTab('noshow')} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${tab === 'noshow' ? 'bg-white shadow dark:bg-slate-900' : 'text-muted'}`}><UserX className="h-4 w-4" /> No-show list</button>
        </div>
        {tab === 'all' && (
          <>
            <select className="input w-auto" value={role} onChange={(e) => { setRole(e.target.value); setPage(0) }} aria-label="Role">
              <option value="">All roles</option>
              <option value="STUDENT">Students</option>
              <option value="RESTAURANT">Restaurant staff</option>
            </select>
            <div className="relative w-full sm:w-auto sm:min-w-56 sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input pl-9" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
            </div>
          </>
        )}
      </div>

      {list.loading ? (
        <PageLoader />
      ) : list.error ? (
        <ErrorBox message={list.error} onRetry={list.reload} />
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {list.data.content.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">No users found</li>}
            {list.data.content.map((u) => <UserCard key={u.id} u={u} onChange={onChange} onPassword={setPwFor} />)}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-muted dark:bg-slate-800/50">
                <tr><th className="px-4 py-2.5">User</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Joined</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {list.data.content.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No users found</td></tr>}
                {list.data.content.map((u) => <UserRow key={u.id} u={u} onChange={onChange} onPassword={setPwFor} />)}
              </tbody>
            </table>
          </div>
          {list.data.totalPages > 1 && (
            <div className="flex justify-end gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
              <button className="btn-secondary py-1.5" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="btn-secondary py-1.5" disabled={page + 1 >= list.data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}

      <Modal open={!!pwFor} onClose={() => setPwFor(null)} title={`Reset password – ${pwFor?.name ?? ''}`}>
        <form onSubmit={resetPassword} className="space-y-3">
          <input required minLength={6} className="input" placeholder="New password" aria-label="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted">They can change it later in their account.</p>
          <button className="btn-primary w-full" disabled={saving}>{saving && <Spinner className="h-4 w-4" />} Reset password</button>
        </form>
      </Modal>
    </>
  )
}
