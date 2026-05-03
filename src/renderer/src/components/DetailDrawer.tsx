import { Maximize2, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ContentItem } from '../lib/api'
import { formatBytes } from '../lib/contentType'
import { ImageLightbox } from './ImageLightbox'
import { TypeBadge } from './TypeBadge'

interface Props {
  item: ContentItem | null
  onClose: () => void
  onDelete: (id: string) => Promise<void>
}

export function DetailDrawer({ item, onClose, onDelete }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !lightboxOpen) onClose()
    }
    if (item) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose, lightboxOpen])

  useEffect(() => {
    if (!item) setLightboxOpen(false)
  }, [item])

  if (!item) return null

  const isImage = item.content_type === 'image'
  const previewSrc = isImage && item.source_path
    ? `file://${item.source_path}`
    : item.thumbnail_path
      ? `file://${item.thumbnail_path}`
      : null

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

          {previewSrc ? (
            <div
              role={isImage ? 'button' : undefined}
              tabIndex={isImage ? 0 : -1}
              onClick={() => isImage && setLightboxOpen(true)}
              onKeyDown={(e) => {
                if (isImage && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  setLightboxOpen(true)
                }
              }}
              title={isImage ? 'Click to view at full resolution' : undefined}
              style={{
                position: 'relative',
                marginBottom: 16,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-muted)',
                overflow: 'hidden',
                cursor: isImage ? 'zoom-in' : 'default'
              }}
            >
              <img
                src={previewSrc}
                alt={item.title}
                decoding="async"
                style={{
                  width: '100%',
                  maxHeight: isImage ? 480 : 320,
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
              {isImage ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                    color: '#fff',
                    background: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(4px)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <Maximize2 size={11} strokeWidth={2.4} />
                  Original
                </span>
              ) : null}
            </div>
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
      {lightboxOpen && isImage && previewSrc ? (
        <ImageLightbox src={previewSrc} alt={item.title} onClose={() => setLightboxOpen(false)} />
      ) : null}
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
