import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  file: File | null
  onResolve: (description: string | null) => void
}

/** Pre-ingest gate for single-image drops. Lets the user attach a description
 * that becomes searchable text alongside the image's CLIP embedding. */
export function ImageDescriptionModal({ file, onResolve }: Props) {
  const [description, setDescription] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Object URL lifecycle — created when a file arrives, revoked when it leaves.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    if (file) {
      setDescription('')
      // Defer focus so the modal mounts before we steal focus.
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [file])

  useEffect(() => {
    if (!file) return
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        onResolve(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [file, onResolve])

  if (!file || !previewUrl) return null

  function submit(): void {
    const trimmed = description.trim()
    onResolve(trimmed.length > 0 ? trimmed : null)
  }

  function handleTextareaKey(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <>
      <div
        onClick={() => onResolve(null)}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 950,
          animation: 'rfFade 160ms var(--ease)'
        }}
      />
      <div
        role="dialog"
        aria-label="Add image description"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(560px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 64px)',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 960,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'rfSlideIn 200ms var(--ease)'
        }}
      >
        <div
          style={{
            padding: '14px 18px 10px',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-primary)' }}>
            Describe this image
          </div>
          <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--fg-muted)' }}>
            Optional — adds searchable text alongside the visual embedding.
          </div>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflow: 'auto' }}>
          <img
            src={previewUrl}
            alt={file.name}
            decoding="async"
            style={{
              width: '100%',
              maxHeight: 260,
              objectFit: 'contain',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-muted)'
            }}
          />

          <textarea
            ref={textareaRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleTextareaKey}
            placeholder="What is this image? Add context, names, location, what it depicts…"
            rows={4}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              color: 'var(--fg-primary)',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              outline: 'none',
              resize: 'vertical'
            }}
          />

          <div style={{ fontSize: 11.5, color: 'var(--fg-subtle)', marginTop: -6 }}>
            <span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> to save · <span className="kbd">Esc</span> to skip
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '12px 18px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-subtle)'
          }}
        >
          <button
            type="button"
            onClick={() => onResolve(null)}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--fg-secondary)',
              background: 'transparent',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={submit}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--fg-on-accent)',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}
          >
            Save & Ingest
          </button>
        </div>
      </div>
    </>
  )
}
