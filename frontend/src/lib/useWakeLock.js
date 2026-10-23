import { useEffect } from 'react'

/**
 * Keeps the screen on while staff screens are open, so the counter phone doesn't lock
 * in the middle of the lunch rush. Browsers drop the lock when the app is hidden,
 * so it is taken again whenever the app comes back. Silently does nothing where unsupported.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock = null
    let stopped = false

    const take = async () => {
      if (stopped || document.visibilityState !== 'visible') return
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        /* battery saver or no permission – the screen just locks normally */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') take()
    }

    take()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [])
}
