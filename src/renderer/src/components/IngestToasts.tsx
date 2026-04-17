import type { IngestLogEntry, IngestStatus } from '../hooks/useIngest'

interface Props {
  log: IngestLogEntry[]
}

const MAX_VISIBLE = 5

export function IngestToasts({ log }: Props) {
  if (log.length === 0) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 950
      }}
    >
      {log.slice(-MAX_VISIBLE).map((e) => (
        <Toast key={e.id} entry={e} />
      ))}
    </div>
  )
}

function Toast({ entry }: { entry: IngestLogEntry }) {
  return (
    <div
      role="status"
      style={{
        minWidth: 280,
        padding: '10px 14px',
        background: 'var(--bg-panel)',
        border: `1px solid ${borderFor(entry.status)}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}
    >
      <Dot status={entry.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            color: 'var(--fg-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {entry.filename}
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
          {entry.status === 'uploading' && 'Ingesting...'}
          {entry.status === 'done' && 'Added to library'}
          {entry.status === 'error' && (entry.error ?? 'Failed')}
        </div>
      </div>
    </div>
  )
}

function Dot({ status }: { status: IngestStatus }) {
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: colorFor(status),
        flexShrink: 0,
        animation: status === 'uploading' ? 'rfPulse 1.2s ease-in-out infinite' : undefined
      }}
    />
  )
}

function colorFor(status: IngestStatus): string {
  if (status === 'error') return '#ef4444'
  if (status === 'done') return '#10b981'
  return 'var(--accent)'
}

function borderFor(status: IngestStatus): string {
  if (status === 'error') return 'color-mix(in srgb, #ef4444 40%, transparent)'
  if (status === 'done') return 'color-mix(in srgb, #10b981 40%, transparent)'
  return 'var(--border-subtle)'
}
