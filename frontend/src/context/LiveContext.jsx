import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'
import { alertsMuted, playBeep, playChime, showBrowserNotification } from '../lib/alerts'
import { isPushActive, syncPush } from '../lib/push'

/**
 * One Server-Sent Events connection to the Notification Service (through the gateway).
 * Pages subscribe to events instead of polling the server every few seconds.
 */
const LiveContext = createContext(null)

/** Events that deserve a sound + popup. */
const LOUD = new Set(['ORDER_READY', 'NEW_ORDER', 'SOLD_OUT', 'ORDER_ON_THE_WAY', 'ORDER_DELIVERY_MISSED'])
// ORDER_BOOKED (ready-made, nothing to do) has no popup or sound on purpose – it only refreshes the screens
const TOAST = {
  STOCK_LOW: 'info',
  DAY_SUMMARY: 'success',
  SOLD_OUT: 'error',
  ORDER_READY: 'success',
  ORDER_PREPARING: 'info',
  ORDER_REJECTED: 'error',
  ORDER_COLLECTED: 'success',
  ORDER_CANCELLED: 'info',
  ORDER_NO_SHOW: 'error',
  NEW_ORDER: 'info',
  ANNOUNCEMENT: 'info',
  ORDER_ON_THE_WAY: 'success',
  ORDER_DELIVERY_MISSED: 'error',
  FACULTY_APPROVED: 'success',
  FACULTY_REJECTED: 'error',
  FACULTY_REQUEST: 'info',
}

export function LiveProvider({ children }) {
  const { token, user } = useAuth()
  const role = user?.role
  const [connected, setConnected] = useState(false)
  const listeners = useRef(new Set())

  useEffect(() => {
    if (!token) {
      setConnected(false)
      return
    }
    const source = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`)
    source.addEventListener('connected', () => setConnected(true))
    source.addEventListener('notification', (e) => {
      let event
      try {
        event = JSON.parse(e.data)
      } catch {
        return
      }
      listeners.current.forEach((fn) => fn(event))
      // Staff just handed this order over and see the full-screen result already;
      // the student-worded "Enjoy your meal!" popup would only cover it
      const kind = role === 'RESTAURANT' && event.type === 'ORDER_COLLECTED' ? null : TOAST[event.type]
      if (kind && event.title) {
        const text = event.message ? `${event.title}\n${event.message}` : event.title
        if (kind === 'error') toast.error(text, { duration: 6000 })
        else if (kind === 'success') toast.success(text, { duration: 6000 })
        else toast(text, { duration: 4000 })
      }
      // Alerts switched off on this phone: the on-screen message above is enough
      if (!alertsMuted()) {
        if (LOUD.has(event.type)) {
          playChime()
          // With push on, the service worker shows the system notification instead (no duplicates)
          if (!isPushActive()) showBrowserNotification(event.title, event.message)
        } else if (kind) {
          playBeep()
        }
      }
    })
    source.onerror = () => setConnected(false) // EventSource reconnects by itself
    source.onopen = () => setConnected(true)
    // Already allowed alerts on this phone? Make sure the server knows it's this user's phone now
    syncPush().catch(() => {})
    return () => source.close()
  }, [token, role])

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn)
    return () => listeners.current.delete(fn)
  }, [])

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe])
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}

export function useLive() {
  return useContext(LiveContext)
}

/**
 * Run `handler` for live events of the given types (or all events when types is empty).
 * Pages use it to reload their data the moment something changes.
 */
export function useLiveEvent(types, handler) {
  const { subscribe } = useLive()
  const saved = useRef(handler)
  useEffect(() => {
    saved.current = handler
  })
  const key = Array.isArray(types) ? types.join(',') : types
  useEffect(() => {
    const wanted = key ? new Set(key.split(',')) : null
    return subscribe((event) => {
      if (!wanted || wanted.has(event.type)) saved.current(event)
    })
  }, [key, subscribe])
}
