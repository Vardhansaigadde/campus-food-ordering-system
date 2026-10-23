import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { api, errorMessage } from './api'

/**
 * Offline backup for the counter phone: the last order list stays visible when the internet drops,
 * and handovers typed meanwhile (Order ID + OTP) are confirmed automatically once it is back.
 */
const PREFIX = 'cf-offline:'
const QUEUE = `${PREFIX}handovers`

/** axios gives no response when the phone has no internet or the server can't be reached. */
export function isNetworkError(e) {
  return !e?.response
}

export function saveSnapshot(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* storage full or blocked – the backup is a nice-to-have */
  }
}

export function loadSnapshot(key) {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + key))
  } catch {
    return null
  }
}

/** Loads from the API and keeps a copy; without internet returns the copy and reports when it was taken. */
export async function withSnapshot(key, load, onOffline) {
  try {
    const data = await load()
    saveSnapshot(key, data)
    onOffline(null)
    return data
  } catch (e) {
    const snap = isNetworkError(e) ? loadSnapshot(key) : null
    if (!snap) throw e
    onOffline(snap.at)
    return snap.data
  }
}

export function queuedHandovers() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE)) ?? []
  } catch {
    return []
  }
}

export function queueHandover(token, otp) {
  const rest = queuedHandovers().filter((h) => h.token !== token)
  localStorage.setItem(QUEUE, JSON.stringify([...rest, { token, otp, at: Date.now() }]))
}

function removeHandover(token) {
  localStorage.setItem(QUEUE, JSON.stringify(queuedHandovers().filter((h) => h.token !== token)))
}

// One sync at a time for the whole app (two screens, or React running effects twice, must not
// send the same handover twice – the second would bounce off the first and raise a false alarm)
let syncing = false

async function syncHandovers() {
  if (syncing || queuedHandovers().length === 0) return
  syncing = true
  try {
    for (const h of queuedHandovers()) {
      try {
        await api.post('/restaurant/orders/verify', { token: h.token, otp: h.otp })
        removeHandover(h.token)
        toast.success(`${h.token} confirmed – it was handed over without internet`)
      } catch (e) {
        if (isNetworkError(e)) return // still offline – try again later
        const message = errorMessage(e)
        if (/already collected/i.test(message)) {
          removeHandover(h.token) // confirmed earlier (e.g. by another staff phone)
        } else if (/updated on another screen/i.test(message)) {
          // the order changed at the same moment – keep it and try again next round
        } else {
          removeHandover(h.token)
          toast.error(`${h.token} was handed over without internet, but: ${message} Please check with the student.`, { duration: 20000 })
        }
      }
    }
  } finally {
    syncing = false
  }
}

/** Staff layout: sends handovers saved offline as soon as the internet is back. */
export function useHandoverSync() {
  useEffect(() => {
    const sync = () => syncHandovers()
    sync()
    window.addEventListener('online', sync)
    const id = setInterval(sync, 30_000)
    return () => {
      window.removeEventListener('online', sync)
      clearInterval(id)
    }
  }, [])
}
