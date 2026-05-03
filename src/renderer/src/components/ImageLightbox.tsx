import { X } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  src: string
  alt?: string
  onClose: () => void
}

/** Full-window image viewer. Clicks anywhere or Esc to close. The image
 * renders at natural resolution; oversized images are pannable via scroll. */
export function ImageLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-label={alt ?? 'Image preview'}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0, 0, 0, 0.92)',
        overflow: 'auto',
        cursor: 'zoom-out',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 24,
        animation: 'rfFade 160ms var(--ease)'
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close"
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          width: 36,
          height: 36,
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(255, 255, 255, 0.08)',
          color: '#fff',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer'
        }}
      >
        <X size={18} strokeWidth={2} />
      </button>
      <img
        src={src}
        alt={alt ?? ''}
        decoding="async"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 'none',
          height: 'auto',
          display: 'block',
          cursor: 'default',
          boxShadow: '0 16px 60px rgba(0, 0, 0, 0.5)'
        }}
      />
    </div>
  )
}
