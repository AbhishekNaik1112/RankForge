import { useEffect, useState } from 'react'

/** Poll the main process once on mount to know if the Python sidecar is up. */
export function usePythonStatus(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api
      .getPythonStatus()
      .then((s) => {
        if (!cancelled) setReady(s.running)
      })
      .catch(() => {
        if (!cancelled) setReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return ready
}
