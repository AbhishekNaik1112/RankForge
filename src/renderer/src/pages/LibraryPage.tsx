import { useEffect, useState } from 'react'
import { LibraryGrid } from '../components/LibraryGrid'
import { listContent, type ContentItem } from '../lib/api'

interface Props {
  onOpen: (id: string) => void
  refreshKey: number
}

export function LibraryPage({ onOpen, refreshKey }: Props) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listContent()
      .then((data) => {
        if (!cancelled) {
          setItems(data)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load library')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Library
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>
          {loading
            ? 'Loading...'
            : `${items.length} item${items.length === 1 ? '' : 's'}`}
        </p>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            fontSize: 13,
            color: '#b91c1c',
            background: 'color-mix(in srgb, #ef4444 10%, var(--bg-panel))',
            border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          {error}
        </div>
      ) : (
        <LibraryGrid items={items} onOpen={onOpen} />
      )}
    </div>
  )
}
