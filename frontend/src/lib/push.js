import { api } from './api'
import { alertsMuted, setAlertsMuted } from './alerts'

/**
 * Web Push: alerts that arrive with the app closed and the phone locked.
 * The service worker side lives in public/push-sw.js; the server side in the Notification Service.
 * Needs https (or localhost) and the built app's service worker – `npm run dev` has none.
 */

let active = false
const listeners = new Set()

function setActive(value) {
  active = value
  listeners.forEach((fn) => fn(value))
}

/** True while this phone is registered for push – the live stream then leaves popups to the service worker. */
export function isPushActive() {
  return active
}

export function onPushChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function registration() {
  if (!pushSupported()) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

function keyBytes(base64url) {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function sameKey(subscription, key) {
  const current = subscription.options?.applicationServerKey
  if (!current) return true
  const a = new Uint8Array(current)
  return a.length === key.length && a.every((v, i) => v === key[i])
}

/**
 * Makes sure this phone is subscribed and the server knows it belongs to the logged-in user.
 * Never asks for permission – call {@link enablePush} from a button for that.
 * Returns 'on' | 'off' | 'denied' | 'unsupported'.
 */
export async function syncPush() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') {
    setActive(false)
    return 'denied'
  }
  if (Notification.permission !== 'granted' || alertsMuted()) {
    setActive(false)
    return 'off'
  }
  const reg = await registration()
  if (!reg) {
    setActive(false)
    return 'unsupported'
  }
  const { data } = await api.get('/notifications/push/key')
  const key = keyBytes(data.publicKey)
  let sub = await reg.pushManager.getSubscription()
  if (sub && !sameKey(sub, key)) {
    await sub.unsubscribe()
    sub = null
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  await api.post('/notifications/push/subscribe', sub.toJSON())
  setActive(true)
  return 'on'
}

/** From a button tap: asks for permission, then subscribes. Also undoes "alerts off". */
export async function enablePush() {
  setAlertsMuted(false)
  if (!pushSupported()) return 'unsupported'
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (permission !== 'granted') {
    setActive(false)
    return permission === 'denied' ? 'denied' : 'off'
  }
  return syncPush()
}

/**
 * On logout: this phone must stop getting the previous user's alerts.
 * Takes the token explicitly because the session is being cleared at the same moment.
 */
export async function disablePush(token) {
  setActive(false)
  const reg = await registration().catch(() => null)
  const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null
  if (!sub) return
  if (token) {
    await fetch('/api/notifications/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: sub.endpoint }),
      keepalive: true,
    }).catch(() => {})
  }
  await sub.unsubscribe().catch(() => {})
}

/** "Alerts off" from the bell: this phone stays quiet and the server stops sending to it. */
export async function turnOffAlerts(token) {
  setAlertsMuted(true)
  await disablePush(token)
}

/** Current state without side effects – for showing or hiding the "turn on alerts" prompt. */
export async function pushStatus() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (alertsMuted()) return 'muted' // switched off on purpose – don't nag
  if (Notification.permission !== 'granted') return 'off'
  const reg = await registration()
  if (!reg) return 'unsupported'
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off'
}
