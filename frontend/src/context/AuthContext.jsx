import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, loadSession, saveSession, setToken, setUnauthorizedHandler } from '../lib/api'
import { disablePush } from '../lib/push'

const AuthContext = createContext(null)

/** Refresh the token when less than this much time is left, so nobody is logged out mid-order. */
const REFRESH_WHEN_LEFT_MS = 60 * 60 * 1000

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const s = loadSession()
    if (s && s.expiresAt && s.expiresAt < Date.now()) return null
    return s
  })

  const apply = useCallback((data) => {
    const next = data
      ? { token: data.token, user: data.user, expiresAt: Date.now() + data.expiresInSeconds * 1000 }
      : null
    setToken(next?.token ?? null)
    saveSession(next)
    setSession(next)
    return next?.user
  }, [])

  const logout = useCallback(() => {
    // This phone must stop receiving this user's alerts
    disablePush(session?.token)
    apply(null)
  }, [apply, session])

  useEffect(() => {
    setToken(session?.token ?? null)
    setUnauthorizedHandler(() => apply(null))
  }, [session, apply])

  // Silent token refresh
  useEffect(() => {
    if (!session) return
    const check = async () => {
      if (session.expiresAt - Date.now() < REFRESH_WHEN_LEFT_MS) {
        try {
          const { data } = await api.post('/auth/refresh')
          apply(data)
        } catch {
          /* the 401 handler logs out if the token is really invalid */
        }
      }
    }
    check()
    const id = setInterval(check, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [session, apply])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      async login(email, password) {
        const { data } = await api.post('/auth/login', { email, password })
        return apply(data)
      },
      async adminLogin(email, password) {
        const { data } = await api.post('/auth/ops/login', { email, password })
        return apply(data)
      },
      async register(form) {
        const { data } = await api.post('/auth/register', form)
        return apply(data)
      },
      async reloadUser() {
        const { data } = await api.get('/auth/me')
        setSession((s) => {
          const next = s ? { ...s, user: data } : s
          saveSession(next)
          return next
        })
      },
      logout,
    }),
    [session, apply, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

/** Where each role lands after logging in. */
export function homeFor(user, adminBase) {
  if (!user) return '/login'
  if (user.role === 'RESTAURANT') return '/kitchen'
  if (user.role === 'ADMIN') return `${adminBase}/dashboard`
  return '/restaurants'
}
