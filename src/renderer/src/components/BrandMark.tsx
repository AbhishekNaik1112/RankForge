/**
 * RankForge brand mark — three descending ranked rows on an indigo→violet
 * gradient. Same composition as resources/icon.png, kept in sync visually.
 *
 * Reads as "ranked search results" at any size. Used in the sidebar (28-32 px)
 * and the setup wizard (38-48 px). Pass `size` to scale.
 */
interface Props {
  size?: number
  ariaLabel?: string
}

export function BrandMark({ size = 32, ariaLabel = 'RankForge' }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="rf-brand-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7.5" fill="url(#rf-brand-gradient)" />
      {/* Row 1 — full opacity */}
      <circle cx="9" cy="10.5" r="1.45" fill="white" />
      <rect x="12.5" y="9.6" width="11.5" height="1.85" rx="0.92" fill="white" />
      {/* Row 2 — 85% */}
      <circle cx="9" cy="16" r="1.45" fill="white" fillOpacity="0.85" />
      <rect x="12.5" y="15.1" width="9" height="1.85" rx="0.92" fill="white" fillOpacity="0.85" />
      {/* Row 3 — 70% */}
      <circle cx="9" cy="21.5" r="1.45" fill="white" fillOpacity="0.7" />
      <rect x="12.5" y="20.6" width="6.5" height="1.85" rx="0.92" fill="white" fillOpacity="0.7" />
    </svg>
  )
}
