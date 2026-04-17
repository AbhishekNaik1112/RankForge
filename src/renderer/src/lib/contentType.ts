import {
  FileText,
  FileType,
  Image as ImageIcon,
  Presentation,
  ScrollText
} from 'lucide-react'
import type { ContentType } from './api'

export interface ContentTypeMeta {
  label: string
  icon: typeof FileText
  color: string
}

export const CONTENT_TYPE_META: Record<ContentType, ContentTypeMeta> = {
  text:     { label: 'Text',     icon: FileText,     color: 'var(--type-text)' },
  markdown: { label: 'Markdown', icon: ScrollText,   color: 'var(--type-markdown)' },
  pdf:      { label: 'PDF',      icon: FileType,     color: 'var(--type-pdf)' },
  docx:     { label: 'Word',     icon: FileText,     color: 'var(--type-docx)' },
  pptx:     { label: 'Slides',   icon: Presentation, color: 'var(--type-pptx)' },
  image:    { label: 'Image',    icon: ImageIcon,    color: 'var(--type-image)' }
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`
}
