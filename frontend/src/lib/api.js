import axios from 'axios'

/**
 * Single HTTP client for the whole app.
 * Every request goes to /api/... which is the API Gateway (port 8080) – never directly to a microservice.
 */
const STORAGE_KEY = 'cf-auth'

export function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode – session lives only in memory */
  }
}

export const api = axios.create({ baseURL: '/api', timeout: 15000 })

let currentToken = loadSession()?.token ?? null
let onUnauthorized = () => {}

export function setToken(token) {
  currentToken = token
}

export function getToken() {
  return currentToken
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

api.interceptors.request.use((config) => {
  if (currentToken) config.headers.Authorization = `Bearer ${currentToken}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url ?? ''
    if (error.response?.status === 401 && currentToken && !url.startsWith('/auth/login')) {
      onUnauthorized()
    }
    return Promise.reject(error)
  },
)

/** Human-readable message from any API error. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.message) return error.response.data.message
  if (error?.code === 'ECONNABORTED') return 'The server is taking too long. Please try again.'
  if (!error?.response) return 'Cannot reach the server. Check your connection.'
  if (error.response.status === 503) return 'Service temporarily unavailable. Please try again in a minute.'
  return fallback
}

/** Random key so a double-click or a retry never creates two orders. */
export function newIdempotencyKey() {
  if (crypto?.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
