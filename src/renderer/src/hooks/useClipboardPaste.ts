import { useEffect } from 'react'

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp'
}

/** Captures clipboard image pastes (Ctrl/Cmd+V) and forwards each image as a
 * File to the supplied callback. Non-image clipboard contents are ignored. */
export function useClipboardPaste(onImagePaste: (file: File) => void): void {
  useEffect(() => {
    function handler(e: ClipboardEvent): void {
      const data = e.clipboardData
      if (!data) return

      // ClipboardItems is the modern path; fall back to .files for older flows.
      const collected: File[] = []
      for (const item of Array.from(data.items)) {
        if (item.kind !== 'file') continue
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (file) collected.push(file)
      }
      if (collected.length === 0) {
        for (const file of Array.from(data.files)) {
          if (file.type.startsWith('image/')) collected.push(file)
        }
      }

      if (collected.length === 0) return

      // Prevent the default paste so it doesn't also dump into a focused
      // input/textarea elsewhere on the page.
      e.preventDefault()

      const stamp = Date.now()
      collected.forEach((blob, idx) => {
        const ext = MIME_EXT[blob.type] ?? 'png'
        const suffix = collected.length === 1 ? '' : `-${idx + 1}`
        const name = blob.name && blob.name !== 'image.png'
          ? blob.name
          : `clipboard-${stamp}${suffix}.${ext}`
        const file = new File([blob], name, { type: blob.type })
        onImagePaste(file)
      })
    }

    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [onImagePaste])
}
