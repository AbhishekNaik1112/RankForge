import { Library, Network, Search, Settings } from 'lucide-react'

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
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-subtle)',
        padding: 'var(--space-3)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 'var(--space-3) var(--space-2) var(--space-4)'
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--fg-on-accent)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            fontSize: 13
          }}
          aria-hidden
        >
          R
        </div>
        <div style={{ fontWeight: 600, letterSpacing: '-0.01em', fontSize: 15 }}>
          RankForge
        </div>
      </div>

      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
      >
        {NAV.map((item) => {
          const Icon = item.icon
          const active = current === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                border: 'none',
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--fg-secondary)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                cursor: 'pointer',
                textAlign: 'left',
                transition: `background var(--duration-fast) var(--ease), color var(--duration-fast) var(--ease)`
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent'
              }}
            >
              <Icon size={16} strokeWidth={2} />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: 'var(--fg-muted)'
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: pythonReady ? '#10b981' : '#ef4444',
            boxShadow: pythonReady
              ? '0 0 0 3px color-mix(in srgb, #10b981 20%, transparent)'
              : '0 0 0 3px color-mix(in srgb, #ef4444 20%, transparent)'
          }}
        />
        {pythonReady ? 'Backend ready' : 'Backend offline'}
      </div>
    </aside>
  )
}
