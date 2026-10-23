import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Spinner } from '../../components/ui'
import { ADMIN_BASE } from '../../config'
import NotFound from '../NotFound'

/**
 * Hidden admin sign-in. It is only reachable by typing the secret URL.
 * A wrong login shows the normal "page not found" screen, so the page gives nothing away.
 */
export default function AdminLogin() {
  const { user, adminLogin } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (user?.role === 'ADMIN') return <Navigate to={`${ADMIN_BASE}/dashboard`} replace />
  if (user || failed) return <NotFound />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await adminLogin(form.email, form.password)
      navigate(`${ADMIN_BASE}/dashboard`, { replace: true })
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-slate-800 p-6 shadow-xl">
        <div className="flex items-center gap-2 text-slate-200">
          <Lock className="h-5 w-5" />
          <span className="font-semibold">Sign in</span>
        </div>
        <input
          type="email"
          required
          autoComplete="username"
          placeholder="Email"
          className="input border-slate-700 bg-slate-900 text-slate-100"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          className="input border-slate-700 bg-slate-900 text-slate-100"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button className="btn w-full bg-slate-100 text-slate-900 hover:bg-white" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />} Continue
        </button>
      </form>
    </div>
  )
}
