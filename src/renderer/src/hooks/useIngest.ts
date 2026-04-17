import { useCallback, useEffect, useState } from 'react'
import { ingestFile } from '../lib/api'

export type IngestStatus = 'uploading' | 'done' | 'error'

export interface IngestLogEntry {
  id: string  // unique per file to avoid state collisions with same-name drops
  filename: string
  status: IngestStatus
  error?: string
}

interface UseIngest {
  ingestLog: IngestLogEntry[]
  ingestFiles: (files: File[]) => Promise<void>
  /** Bumps when any ingest completes (success or failure). Feed this to
   * downstream components that list content so they refetch. */
  dataVersion: number
}

const TOAST_DISMISS_MS = 3000

export function useIngest(): UseIngest {
  const [ingestLog, setIngestLog] = useState<IngestLogEntry[]>([])
  const [dataVersion, setDataVersion] = useState(0)

  const ingestFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      const entry: IngestLogEntry = {
        id: crypto.randomUUID(),
        filename: file.name,
        status: 'uploading'
      }
      setIngestLog((prev) => [...prev, entry])

      try {
        const buffer = await file.arrayBuffer()
        await ingestFile({ buffer, filename: file.name })
        setIngestLog((prev) =>
          prev.map((e) => (e.id === entry.id ? { ...e, status: 'done' } : e))
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed'
        setIngestLog((prev) =>
          prev.map((e) =>
            e.id === entry.id ? { ...e, status: 'error', error: message } : e
          )
        )
      }
    }
    setDataVersion((v) => v + 1)
  }, [])

  // Auto-dismiss settled (done/error) toasts after TOAST_DISMISS_MS.
  useEffect(() => {
    if (ingestLog.length === 0) return
    const timer = setTimeout(() => {
      setIngestLog((prev) => prev.filter((e) => e.status === 'uploading'))
    }, TOAST_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [ingestLog])

  return { ingestLog, ingestFiles, dataVersion }
}
