import { Search } from 'lucide-react'
import { forwardRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  loading?: boolean
  placeholder?: string
}

export const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar(
  { value, onChange, onSubmit, loading, placeholder },
  ref
) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        transition: `border-color var(--duration-fast) var(--ease), box-shadow var(--duration-fast) var(--ease)`
      }}
      onFocusCapture={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.boxShadow = '0 0 0 3px var(--ring)'
      }}
      onBlurCapture={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)'
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
      }}
    >
      <Search size={16} strokeWidth={2} color="var(--fg-muted)" aria-hidden />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search your knowledge...'}
        aria-label="Search"
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--fg-primary)',
          fontSize: 14,
          fontFamily: 'var(--font-sans)'
        }}
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        style={{
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--fg-on-accent)',
          background: 'var(--accent)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
          opacity: loading || !value.trim() ? 0.55 : 1,
          transition: `background var(--duration-fast) var(--ease)`
        }}
        onMouseEnter={(e) => {
          if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--accent-hover)'
        }}
        onMouseLeave={(e) => {
          if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--accent)'
        }}
      >
        {loading ? 'Searching...' : 'Search'}
      </button>
    </form>
  )
})
