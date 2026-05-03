/**
 * Top-of-window banner for update notifications. Renders only when there's
 * something worth interrupting the user for: an update is available, being
 * downloaded, or ready to install. Idle / not-available states render null.
 */
import { Download, RefreshCw, X } from 'lucide-react'
import type { UpdateStatus } from '../hooks/useUpdater'

interface Props {
  status: UpdateStatus
  onDownload: () => void
  onInstall: () => void
  onDismiss: () => void
}

export function UpdateBanner({ status, onDownload, onInstall, onDismiss }: Props) {
  if (
    status.kind === 'idle' ||
    status.kind === 'checking' ||
    status.kind === 'not-available' ||
    status.kind === 'dev-mode'
  ) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 18px',
        background:
          'linear-gradient(90deg, color-mix(in srgb, var(--accent) 22%, var(--bg-panel)), var(--bg-panel))',
        borderBottom: '1px solid color-mix(in srgb, var(--accent) 35%, var(--border-subtle))',
        fontSize: 13.5,
        color: 'var(--fg-primary)'
      }}
    >
      <Icon status={status} />
      <Body status={status} />
      <div style={{ flex: 1 }} />
      <Actions
        status={status}
        onDownload={onDownload}
        onInstall={onInstall}
        onDismiss={onDismiss}
      />
    </div>
  )
}

function Icon({ status }: { status: UpdateStatus }) {
  if (status.kind === 'available') {
    return <Download size={16} strokeWidth={2.2} aria-hidden style={{ color: 'var(--accent)' }} />
  }
  if (status.kind === 'downloading') {
    return (
      <RefreshCw
        size={16}
        strokeWidth={2.2}
        aria-hidden
        className="rf-spin"
        style={{ color: 'var(--accent)' }}
      />
    )
  }
  if (status.kind === 'downloaded') {
    return <Download size={16} strokeWidth={2.2} aria-hidden style={{ color: '#10b981' }} />
  }
  return null
}

function Body({ status }: { status: UpdateStatus }) {
  if (status.kind === 'available') {
    return (
      <span>
        <strong style={{ fontWeight: 600 }}>Update available</strong>
        <span style={{ color: 'var(--fg-muted)' }}>
          {' '}
          — version {status.version}
        </span>
      </span>
    )
  }
  if (status.kind === 'downloading') {
    return (
      <span>
        Downloading update… <span style={{ color: 'var(--fg-muted)' }}>{status.percent}%</span>
      </span>
    )
  }
  if (status.kind === 'downloaded') {
    return (
      <span>
        <strong style={{ fontWeight: 600 }}>Update ready</strong>
        <span style={{ color: 'var(--fg-muted)' }}>
          {' '}
          — restart RankForge to install version {status.version}
        </span>
      </span>
    )
  }
  if (status.kind === 'error') {
    return <span style={{ color: '#fca5a5' }}>Update failed: {status.message}</span>
  }
  return null
}

function Actions({
  status,
  onDownload,
  onInstall,
  onDismiss
}: {
  status: UpdateStatus
  onDownload: () => void
  onInstall: () => void
  onDismiss: () => void
}) {
  if (status.kind === 'available') {
    return (
      <>
        <PrimaryButton onClick={onDownload}>Download</PrimaryButton>
        <DismissButton onClick={onDismiss} />
      </>
    )
  }
  if (status.kind === 'downloaded') {
    return (
      <>
        <PrimaryButton onClick={onInstall}>Restart &amp; Install</PrimaryButton>
        <DismissButton onClick={onDismiss} />
      </>
    )
  }
  if (status.kind === 'error') {
    return <DismissButton onClick={onDismiss} />
  }
  return null
}

function PrimaryButton({
  children,
  onClick
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px',
        fontSize: 12.5,
        fontWeight: 500,
        color: 'var(--fg-on-accent)',
        background: 'var(--accent)',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss"
      style={{
        width: 26,
        height: 26,
        display: 'grid',
        placeItems: 'center',
        background: 'transparent',
        color: 'var(--fg-muted)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer'
      }}
    >
      <X size={14} strokeWidth={2} />
    </button>
  )
}
