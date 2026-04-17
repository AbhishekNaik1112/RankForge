import { Trash2, X } from 'lucide-react'
import { useEffect } from 'react'
import type { ContentItem } from '../lib/api'
import { formatBytes } from '../lib/contentType'
import { TypeBadge } from './TypeBadge'

interface Props {
  item: ContentItem | null
  onClose: () => void
  onDelete: (id: string) => Promise<void>
}

export function DetailDrawer({ item, onClose, onDelete }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (item) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  if (!item) return null

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          zIndex: 900,
          animation: 'rfFade 180ms var(--ease)'
        }}
      />
      <aside
        role="dialog"
        aria-label={item.title}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(480px, 100%)',
          background: 'var(--bg-panel)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 910,
          animation: 'rfSlideIn 220ms var(--ease)'
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <TypeBadge type={item.content_type} size="md" />
          <div style={{ display: 'flex', gap: 6 }}>
            <IconButton
              label="Delete"
              onClick={async () => {
                if (confirm(`Delete "${item.title}"?`)) {
                  await onDelete(item.id)
                  onClose()
                }
              }}
            >
              <Trash2 size={16} strokeWidth={2} />
            </IconButton>
            <IconButton label="Close" onClick={onClose}>
              <X size={16} strokeWidth={2} />
            </IconButton>
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-6)' }}>
          <h2
            style={{
              margin: '0 0 14px',
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--fg-primary)',
              lineHeight: 1.3
            }}
          >
            {item.title}
          </h2>

          {item.thumbnail_path ? (
            <img
              src={`file://${item.thumbnail_path}`}
              alt={item.title}
              style={{
                width: '100%',
                maxHeight: 320,
                objectFit: 'contain',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-muted)',
                marginBottom: 16
              }}
            />
          ) : null}

          <MetaGrid item={item} />

          {item.body ? (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--fg-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 400,
                overflow: 'auto'
              }}
            >
              {item.body}
            </div>
          ) : null}
        </div>
      </aside>
      <style>{`
        @keyframes rfFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes rfSlideIn { from { transform: translateX(8px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>
    </>
  )
}

function MetaGrid({ item }: { item: ContentItem }) {
  const rows: [string, string | null][] = [
    ['ID', item.id],
    ['MIME', item.mime_type],
    ['Size', formatBytes(item.file_size)],
    ['Path', item.source_path]
  ]
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', margin: 0 }}>
      {rows.map(([k, v]) =>
        v ? (
          <div key={k} style={{ display: 'contents' }}>
            <dt style={{ fontSize: 11, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {k}
            </dt>
            <dd
              style={{
                margin: 0,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-secondary)',
                wordBreak: 'break-all'
              }}
            >
              {v}
            </dd>
          </div>
        ) : null
      )}
    </dl>
  )
}

function IconButton({
  children,
  onClick,
  label
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 30,
        height: 30,
        display: 'grid',
        placeItems: 'center',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-panel)',
        color: 'var(--fg-secondary)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: `background var(--duration-fast) var(--ease)`
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-panel)')}
    >
      {children}
    </button>
  )
}
