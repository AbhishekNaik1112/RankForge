import { CONTENT_TYPE_META } from '../lib/contentType'
import type { ContentType } from '../lib/api'

interface Props {
  type: ContentType
  size?: 'sm' | 'md'
}

export function TypeBadge({ type, size = 'sm' }: Props) {
  const meta = CONTENT_TYPE_META[type]
  const Icon = meta.icon
  const iconSize = size === 'sm' ? 12 : 14
  const padding = size === 'sm' ? '2px 7px' : '4px 10px'
  const fontSize = size === 'sm' ? 11 : 12

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding,
        fontSize,
        fontWeight: 500,
        color: meta.color,
        background: `color-mix(in srgb, ${meta.color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${meta.color} 24%, transparent)`,
        borderRadius: 'var(--radius-sm)',
        lineHeight: 1
      }}
    >
      <Icon size={iconSize} strokeWidth={2} />
      {meta.label}
    </span>
  )
}
