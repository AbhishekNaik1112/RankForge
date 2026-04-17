import type { ContentItem } from '../lib/api'
import { formatBytes } from '../lib/contentType'
import { TypeBadge } from './TypeBadge'

interface Props {
  items: ContentItem[]
  onOpen: (id: string) => void
}

export function LibraryGrid({ items, onOpen }: Props) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-12)',
          textAlign: 'center',
          color: 'var(--fg-muted)',
          fontSize: 14,
          border: '1px dashed var(--border-subtle)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        No content yet. Drop files anywhere on the window to get started.
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
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item.id)}
          style={{
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
      ))}
    </div>
  )
}
