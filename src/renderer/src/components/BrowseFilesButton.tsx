import { FolderOpen } from 'lucide-react'
import { useRef } from 'react'

interface Props {
  onFilesSelected: (files: File[]) => void
  variant?: 'primary' | 'secondary'
  label?: string
}

const ACCEPT = '.txt,.md,.pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp,text/plain,text/markdown'

export function BrowseFilesButton({
  onFilesSelected,
  variant = 'primary',
  label = 'Browse Files'
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleClick() {
    inputRef.current?.click()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onFilesSelected(files)
    e.target.value = ''
  }

  const isPrimary = variant === 'primary'

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={handleClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 16px',
          fontSize: 13,
          fontWeight: 500,
          color: isPrimary ? 'var(--fg-on-accent)' : 'var(--fg-primary)',
          background: isPrimary ? 'var(--accent)' : 'var(--bg-panel)',
          border: isPrimary ? 'none' : '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          transition: `background var(--duration-fast) var(--ease)`
        }}
        onMouseEnter={(e) => {
          if (isPrimary) {
            e.currentTarget.style.background = 'var(--accent-hover)'
          } else {
            e.currentTarget.style.background = 'var(--bg-hover)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isPrimary ? 'var(--accent)' : 'var(--bg-panel)'
        }}
      >
        <FolderOpen size={15} strokeWidth={2} aria-hidden />
        {label}
      </button>
    </>
  )
}
