import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import AuthShell from './AuthShell'
import { homeFor, useAuth } from '../../context/AuthContext'
import { errorMessage } from '../../lib/api'
import { Spinner } from '../../components/ui'
import { ADMIN_BASE } from '../../config'
import { unlockAudio } from '../../lib/alerts'

/** One login page for students and restaurant staff – the role decides where you land. */
export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to={homeFor(user, ADMIN_BASE)} replace />

  const submit = async (e) => {
    e.preventDefault()
    unlockAudio()
    setBusy(true)
    setError('')
    try {
      const u = await login(form.email, form.password)
      const back = location.state?.from
      navigate(back && u.role === 'STUDENT' ? back : homeFor(u, ADMIN_BASE), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to order food or manage your restaurant.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative">
            <input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className="input pr-11"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-0 px-3 text-muted hover:text-slate-600"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />} Log in
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{' '}
        <Link to="/register" className="font-semibold text-brand hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-muted">Restaurant staff: use the login given by the canteen office.</p>
    </AuthShell>
  )
}
