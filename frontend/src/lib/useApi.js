import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from './api'

/**
 * Loads data from the API and keeps loading / error state.
 * `reload({ silent: true })` refreshes without showing a spinner (used for live updates).
 */
export function useApi(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const saved = useRef(loader)
  saved.current = loader
  const latest = useRef(0)

  const reload = useCallback(async ({ silent = false } = {}) => {
    const call = ++latest.current
    if (!silent) setLoading(true)
    try {
      const result = await saved.current()
      if (call === latest.current) {
        setData(result)
        setError(null)
      }
    } catch (e) {
      if (call === latest.current) setError(errorMessage(e))
    } finally {
      if (call === latest.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, setData, loading, error, reload }
}

/** Re-run `fn` every `ms` while the tab is visible (safety net in case a live event is missed). */
export function useInterval(fn, ms) {
  const saved = useRef(fn)
  saved.current = fn
  useEffect(() => {
    if (!ms) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') saved.current()
    }, ms)
    return () => clearInterval(id)
  }, [ms])
}
