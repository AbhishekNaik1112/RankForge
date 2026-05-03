import { useEffect, useMemo, useState } from 'react'
import { LibraryGrid } from '../components/LibraryGrid'
import { listContent, type ContentItem, type ContentType } from '../lib/api'
import { CONTENT_TYPE_META } from '../lib/contentType'

type SortKey = 'recent' | 'oldest' | 'title-asc' | 'title-desc' | 'size-desc' | 'size-asc'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'recent', label: 'Recently added' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'title-asc', label: 'Title A → Z' },
  { id: 'title-desc', label: 'Title Z → A' },
  { id: 'size-desc', label: 'Largest first' },
  { id: 'size-asc', label: 'Smallest first' }
]

const TYPE_ORDER: ContentType[] = ['text', 'markdown', 'pdf', 'docx', 'pptx', 'image']

interface Props {
  onOpen: (id: string) => void
  onIngest: (files: File[]) => void
  onDelete: (id: string) => Promise<void>
  refreshKey: number
}

export function LibraryPage({ onOpen, onIngest, onDelete, refreshKey }: Props) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('recent')
  const [activeTypes, setActiveTypes] = useState<Set<ContentType>>(new Set())

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

  const visibleItems = useMemo(() => {
    const filtered =
      activeTypes.size === 0
        ? items
        : items.filter((it) => activeTypes.has(it.content_type))
    return sortItems(filtered, sort)
  }, [items, activeTypes, sort])

  function toggleType(t: ContentType): void {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>
          Library
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--fg-muted)' }}>
          {loading
            ? 'Loading…'
            : `${visibleItems.length} of ${items.length} item${items.length === 1 ? '' : 's'}`}
        </p>
      </header>

      {!loading && items.length > 0 ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TYPE_ORDER.map((t) => (
              <TypeChip
                key={t}
                type={t}
                active={activeTypes.has(t)}
                onToggle={() => toggleType(t)}
              />
            ))}
            {activeTypes.size > 0 ? (
              <button
                type="button"
                onClick={() => setActiveTypes(new Set())}
                style={{
                  padding: '5px 11px',
                  fontSize: 12,
                  color: 'var(--fg-muted)',
                  background: 'transparent',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 999,
                  cursor: 'pointer'
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              padding: '6px 12px',
              fontSize: 12.5,
              color: 'var(--fg-primary)',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

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
        <LibraryGrid items={visibleItems} onOpen={onOpen} onIngest={onIngest} onDelete={onDelete} />
      )}
    </div>
  )
}

function sortItems(items: ContentItem[], key: SortKey): ContentItem[] {
  switch (key) {
    case 'recent':
      return items
    case 'oldest':
      return [...items].reverse()
    case 'title-asc':
      return [...items].sort((a, b) => a.title.localeCompare(b.title))
    case 'title-desc':
      return [...items].sort((a, b) => b.title.localeCompare(a.title))
    case 'size-desc':
      return [...items].sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))
    case 'size-asc':
      return [...items].sort((a, b) => (a.file_size ?? 0) - (b.file_size ?? 0))
    default:
      return items
  }
}

function TypeChip({
  type,
  active,
  onToggle
}: {
  type: ContentType
  active: boolean
  onToggle: () => void
}) {
  const meta = CONTENT_TYPE_META[type]
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px',
        fontSize: 12,
        color: active ? 'var(--fg-on-accent)' : 'var(--fg-secondary)',
        background: active ? 'var(--accent)' : 'var(--bg-panel)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
        borderRadius: 999,
        cursor: 'pointer',
        transition: 'background var(--duration-fast) var(--ease)'
      }}
    >
      <Icon size={11} strokeWidth={2.2} aria-hidden style={{ color: active ? 'var(--fg-on-accent)' : meta.color }} />
      {meta.label}
    </button>
  )
}
