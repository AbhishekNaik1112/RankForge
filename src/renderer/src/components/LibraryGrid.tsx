import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ContentItem } from '../lib/api'
import { formatBytes } from '../lib/contentType'
import { BrowseFilesButton } from './BrowseFilesButton'
import { TypeBadge } from './TypeBadge'

interface Props {
  items: ContentItem[]
  onOpen: (id: string) => void
  onIngest?: (files: File[]) => void
  onDelete?: (id: string) => Promise<void>
}

export function LibraryGrid({ items, onOpen, onIngest, onDelete }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(item: ContentItem, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    if (!onDelete) return
    if (!window.confirm(`Delete "${item.title}"?`)) return
    setDeletingId(item.id)
    try {
      await onDelete(item.id)
    } finally {
      setDeletingId(null)
    }
  }
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-12)',
          textAlign: 'center',
          color: 'var(--fg-muted)',
          fontSize: 14,
          border: '1px dashed var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16
        }}
      >
        <div>No content yet. Drop files anywhere on the window, or browse to pick.</div>
        {onIngest ? <BrowseFilesButton onFilesSelected={onIngest} /> : null}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 14
      }}
    >
      {items.map((item) => (
        <div
          key={item.id}
          onMouseEnter={() => setHoveredId(item.id)}
          onMouseLeave={() => setHoveredId(null)}
          style={{ position: 'relative' }}
        >
        <button
          type="button"
          onClick={() => onOpen(item.id)}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: 0,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: `border-color var(--duration-fast) var(--ease), box-shadow var(--duration-fast) var(--ease)`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-strong)'
            e.currentTarget.style.boxShadow = 'var(--shadow-md)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {item.thumbnail_path ? (
            <img
              src={`file://${item.thumbnail_path}`}
              alt=""
              aria-hidden
              loading="lazy"
              decoding="async"
              style={{
                width: '100%',
                aspectRatio: '4 / 3',
                objectFit: 'cover',
                background: 'var(--bg-muted)',
                display: 'block'
              }}
            />
          ) : (
            <div
              aria-hidden
              style={{
                width: '100%',
                aspectRatio: '4 / 3',
                background: 'var(--bg-muted)',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <TypeBadge type={item.content_type} size="md" />
            </div>
          )}

          <div style={{ padding: 'var(--space-3) var(--space-4) var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <TypeBadge type={item.content_type} />
              {item.file_size ? (
                <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'var(--font-mono)' }}>
                  {formatBytes(item.file_size)}
                </span>
              ) : null}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--fg-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {item.title}
            </div>
          </div>
        </button>
        {onDelete && hoveredId === item.id ? (
          <button
            type="button"
            onClick={(e) => handleDelete(item, e)}
            disabled={deletingId === item.id}
            aria-label={`Delete ${item.title}`}
            title="Delete"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              display: 'grid',
              placeItems: 'center',
              background: 'color-mix(in srgb, var(--bg-app) 88%, transparent)',
              backdropFilter: 'blur(4px)',
              color: 'var(--fg-secondary)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              cursor: deletingId === item.id ? 'wait' : 'pointer',
              opacity: deletingId === item.id ? 0.5 : 1,
              boxShadow: 'var(--shadow-sm)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ef4444'
              e.currentTarget.style.borderColor = '#ef4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-secondary)'
              e.currentTarget.style.borderColor = 'var(--border-strong)'
            }}
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        ) : null}
        </div>
      ))}
    </div>
  )
}
