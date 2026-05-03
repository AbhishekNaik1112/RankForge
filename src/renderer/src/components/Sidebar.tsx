import { ChevronsLeft, ChevronsRight, Library, Network, Search, Settings } from 'lucide-react'
import { useState } from 'react'
import type { SidebarMode } from '../hooks/useSidebar'
import { BrandMark } from './BrandMark'

export type Page = 'search' | 'library' | 'graph' | 'settings'

interface Props {
  current: Page
  onNavigate: (page: Page) => void
  pythonReady: boolean
  mode: SidebarMode
  onToggle: () => void
}

const NAV: { id: Page; label: string; icon: typeof Search }[] = [
  { id: 'search', label: 'Search', icon: Search },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'graph', label: 'Graph', icon: Network },
  { id: 'settings', label: 'Settings', icon: Settings }
]

const EXPANDED_WIDTH = 232
const COLLAPSED_WIDTH = 56

export function Sidebar({ current, onNavigate, pythonReady, mode, onToggle }: Props) {
  const [hovered, setHovered] = useState(false)
  const isExpanded =
    mode === 'expanded' || (mode === 'hover' && hovered)
  const width = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-subtle)',
        padding: isExpanded ? '14px 12px' : '14px 8px',
        transition: `width var(--duration-base) var(--ease), padding var(--duration-base) var(--ease)`,
        overflow: 'hidden'
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: isExpanded ? '6px 6px 18px' : '6px 4px 18px',
          justifyContent: isExpanded ? 'flex-start' : 'center'
        }}
      >
        <BrandMark size={28} />
        {isExpanded ? (
          <div
            style={{
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: '-0.012em',
              color: 'var(--fg-primary)',
              whiteSpace: 'nowrap'
            }}
          >
            RankForge
          </div>
        ) : null}
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV.map((item) => (
          <NavItem
            key={item.id}
            label={item.label}
            Icon={item.icon}
            active={current === item.id}
            expanded={isExpanded}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Toggle */}
      <button
        type="button"
        onClick={onToggle}
        title={mode === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-label={mode === 'expanded' ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'flex-start' : 'center',
          gap: 11,
          padding: '7px 12px',
          border: 'none',
          background: 'transparent',
          color: 'var(--fg-muted)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12.5,
          cursor: 'pointer',
          transition: 'background var(--duration-fast) var(--ease)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        {mode === 'expanded' ? (
          <ChevronsLeft size={15} strokeWidth={2} />
        ) : (
          <ChevronsRight size={15} strokeWidth={2} />
        )}
        {isExpanded ? <span>Collapse</span> : null}
      </button>

      {/* Status */}
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'flex-start' : 'center',
          gap: 9,
          padding: '10px 12px',
          fontSize: 12,
          color: 'var(--fg-muted)',
          borderTop: '1px solid var(--border-subtle)',
          marginTop: 8
        }}
        title={pythonReady ? 'Backend ready' : 'Backend offline'}
      >
        <StatusDot ok={pythonReady} />
        {isExpanded ? <span>{pythonReady ? 'Backend ready' : 'Backend offline'}</span> : null}
      </div>
    </aside>
  )
}

function NavItem({
  label,
  Icon,
  active,
  expanded,
  onClick
}: {
  label: string
  Icon: typeof Search
  active: boolean
  expanded: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={!expanded ? label : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: expanded ? 'flex-start' : 'center',
        gap: 11,
        padding: expanded ? '8px 12px' : '8px 0',
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
      {active && expanded ? (
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
      {expanded ? label : null}
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
