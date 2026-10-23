import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'
import AuthShell from './AuthShell'
import { homeFor, useAuth } from '../../context/AuthContext'
import { errorMessage } from '../../lib/api'
import { Spinner } from '../../components/ui'
import { ADMIN_BASE } from '../../config'

export default function Register() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to={homeFor(user, ADMIN_BASE)} replace />

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) return setError('Passwords do not match')
    setBusy(true)
    setError('')
    try {
      await register({ name: form.name, email: form.email, phone: form.phone, password: form.password })
      toast.success('Account created – welcome!')
      navigate('/restaurants', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Takes 30 seconds. Then order from any campus restaurant.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" required maxLength={80} autoComplete="name" className="input" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="label" htmlFor="phone">
            Phone <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="phone"
            inputMode="numeric"
            pattern="[0-9]{10}"
            title="10-digit mobile number"
            autoComplete="tel"
            className="input"
            value={form.phone}
            onChange={set('phone')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="password">Password</label>
            <div className="relative">
              <input id="password" type={show ? 'text' : 'password'} required minLength={6} autoComplete="new-password" className="input pr-11" value={form.password} onChange={set('password')} />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-slate-600"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm</label>
            <input id="confirm" type={show ? 'text' : 'password'} required minLength={6} autoComplete="new-password" className="input" value={form.confirm} onChange={set('confirm')} />
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy && <Spinner className="h-4 w-4" />} Create account
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="inline-block py-2 font-semibold text-brand hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  )
}
