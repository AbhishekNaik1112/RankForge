import { Upload } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props {
  onFilesDropped: (files: File[]) => void
}

/**
 * Full-window drag overlay. Shows when the user drags files into the window.
 * Writes bytes via window.api.ingestFile through the parent's callback.
 */
export function DropZone({ onFilesDropped }: Props) {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    let counter = 0

    function handleDragEnter(e: DragEvent) {
      if (!hasFiles(e)) return
      counter += 1
      if (counter === 1) setDragging(true)
    }

    function handleDragLeave(e: DragEvent) {
      if (!hasFiles(e)) return
      counter = Math.max(0, counter - 1)
      if (counter === 0) setDragging(false)
    }

    function handleDragOver(e: DragEvent) {
      if (!hasFiles(e)) return
      e.preventDefault()
    }

    function handleDrop(e: DragEvent) {
      if (!hasFiles(e)) return
      e.preventDefault()
      counter = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length > 0) onFilesDropped(files)
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [onFilesDropped])

  if (!dragging) return null

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-app))',
        backdropFilter: 'blur(2px)',
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          padding: 'var(--space-8) var(--space-12)',
          background: 'var(--bg-panel)',
          border: `2px dashed var(--accent)`,
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          color: 'var(--fg-primary)'
        }}
      >
        <Upload size={44} strokeWidth={1.6} color="var(--accent)" />
        <div style={{ fontSize: 18, fontWeight: 600 }}>Drop files to ingest</div>
        <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
          Text, Markdown, PDF, Word, PowerPoint, Images
        </div>
      </div>
    </div>
  )
}

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}
