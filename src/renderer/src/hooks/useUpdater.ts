/**
 * Subscribes to auto-update events from the main process and exposes the
 * current update state + action wrappers to React components.
 *
 * State machine:
 *   idle → checking → (available | not-available | error | dev-mode)
 *   available → downloading (with progress) → downloaded → (user installs)
 */
import { useCallback, useEffect, useState } from 'react'
import type { UpdateEvent } from '../../../shared/types'

export type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string; releaseDate?: string; releaseNotes?: string }
  | { kind: 'not-available'; version: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string }
  | { kind: 'dev-mode' }

export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>({ kind: 'idle' })

  useEffect(() => {
    const unsubscribe = window.api.onUpdateEvent((event: UpdateEvent) => {
      switch (event.type) {
        case 'checking':
          setStatus({ kind: 'checking' })
          break
        case 'available':
          setStatus({
            kind: 'available',
            version: event.version,
            releaseDate: event.releaseDate,
            releaseNotes: event.releaseNotes
          })
          break
        case 'not-available':
          setStatus({ kind: 'not-available', version: event.version })
          break
        case 'download-progress':
          setStatus({ kind: 'downloading', percent: event.percent })
          break
        case 'downloaded':
          setStatus({ kind: 'downloaded', version: event.version })
          break
        case 'error':
          setStatus({ kind: 'error', message: event.message })
          break
        case 'dev-mode':
          setStatus({ kind: 'dev-mode' })
          break
      }
    })
    return unsubscribe
  }, [])

  const check = useCallback(async () => {
    setStatus({ kind: 'checking' })
    const result = await window.api.checkForUpdates()
    if (!result.ok && result.reason) {
      // checkForUpdates may have already broadcast; this is a fallback.
      setStatus((s) => (s.kind === 'checking' ? { kind: 'error', message: result.reason! } : s))
    }
  }, [])

  const download = useCallback(async () => {
    await window.api.downloadUpdate()
  }, [])

  const install = useCallback(async () => {
    await window.api.quitAndInstall()
  }, [])

  const dismiss = useCallback(() => {
    setStatus({ kind: 'idle' })
  }, [])

  return { status, check, download, install, dismiss }
}
