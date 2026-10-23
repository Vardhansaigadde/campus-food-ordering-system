/**
 * Sound + browser notifications for live events (no audio files needed – tones are generated).
 */
let audioCtx = null

function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    audioCtx = new AC()
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

function tone(freq, start, duration, volume = 0.18) {
  const c = ctx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, c.currentTime + start)
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration)
  osc.connect(gain).connect(c.destination)
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + duration + 0.05)
}

/** "Ding-dong" – order ready / new order. */
export function playChime() {
  tone(880, 0, 0.35)
  tone(660, 0.22, 0.5)
}

/** Short beep – minor update. */
export function playBeep() {
  tone(740, 0, 0.18, 0.12)
}

/** Browsers only allow audio after the user has clicked something once. */
export function unlockAudio() {
  ctx()
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

export function showBrowserNotification(title, body) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png' })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}
