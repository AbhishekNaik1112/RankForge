import { Library, Network, Search, Settings } from 'lucide-react'
import { BrandMark } from './BrandMark'

export type Page = 'search' | 'library' | 'graph' | 'settings'

interface Props {
  current: Page
  onNavigate: (page: Page) => void
  pythonReady: boolean
}

const NAV: { id: Page; label: string; icon: typeof Search }[] = [
  { id: 'search', label: 'Search', icon: Search },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'graph', label: 'Graph', icon: Network },
  { id: 'settings', label: 'Settings', icon: Settings }
]

export function Sidebar({ current, onNavigate, pythonReady }: Props) {
  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-subtle)',
        padding: '14px 12px'
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 6px 18px'
        }}
      >
        <BrandMark size={28} />
        <div
          style={{
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: '-0.012em',
            color: 'var(--fg-primary)'
          }}
        >
          RankForge
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV.map((item) => (
          <NavItem
            key={item.id}
            label={item.label}
            Icon={item.icon}
            active={current === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Status */}
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '10px 12px',
          fontSize: 12,
          color: 'var(--fg-muted)',
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 8
        }}
      >
        <StatusDot ok={pythonReady} />
        <span>{pythonReady ? 'Backend ready' : 'Backend offline'}</span>
      </div>
    </aside>
  )
}

function NavItem({
  label,
  Icon,
  active,
  onClick
}: {
  label: string
  Icon: typeof Search
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '8px 12px',
        border: 'none',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--fg-secondary)',
        borderRadius: 'var(--radius-md)',
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        cursor: 'pointer',
        textAlign: 'left',
        transition:
          'background var(--duration-fast) var(--ease), color var(--duration-fast) var(--ease)'
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Active indicator: 2px accent bar inset on the left */}
      {active ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 4,
            top: 8,
            bottom: 8,
            width: 2,
            background: 'var(--accent)',
            borderRadius: 2
          }}
        />
      ) : null}
      <Icon size={16} strokeWidth={2} />
      {label}
    </button>
  )
}

function StatusDot({ ok }: { ok: boolean }) {
  const color = ok ? '#10b981' : '#ef4444'
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)`,
        flexShrink: 0
      }}
    />
  )
}
