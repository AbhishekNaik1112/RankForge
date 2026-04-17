import type { SearchResult } from '../lib/api'
import { TypeBadge } from './TypeBadge'

interface Props {
  result: SearchResult
  onClick: () => void
}

export function ResultCard({ result, onClick }: Props) {
  const preview = (result.body ?? '').slice(0, 200)

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        gap: 14,
        padding: 'var(--space-4)',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        transition: `border-color var(--duration-fast) var(--ease), box-shadow var(--duration-fast) var(--ease), transform var(--duration-fast) var(--ease)`,
        boxShadow: 'var(--shadow-sm)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-strong)'
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)'
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
      }}
    >
      {result.thumbnail_path ? (
        <img
          src={`file://${result.thumbnail_path}`}
          alt=""
          aria-hidden
          style={{
            width: 64,
            height: 64,
            objectFit: 'cover',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            flexShrink: 0
          }}
        />
      ) : null}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <TypeBadge type={result.content_type} />
          <span style={{ color: 'var(--fg-subtle)', fontSize: 12 }}>·</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-muted)'
            }}
          >
            final {result.final_score.toFixed(3)}
          </span>
        </div>

        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--fg-primary)',
            marginBottom: 4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {result.title}
        </div>

        {preview ? (
          <div
            style={{
              fontSize: 13,
              color: 'var(--fg-muted)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {preview}
          </div>
        ) : null}

        <ScoreStrip
          semantic={result.semantic_similarity}
          keyword={result.keyword_match}
          pagerank={result.pagerank_norm}
          freshness={result.freshness_boost}
        />
      </div>
    </button>
  )
}

interface ScoreStripProps {
  semantic: number
  keyword: number
  pagerank: number
  freshness: number
}

function ScoreStrip({ semantic, keyword, pagerank, freshness }: ScoreStripProps) {
  const entries = [
    { label: 'semantic', value: semantic },
    { label: 'keyword', value: keyword },
    { label: 'authority', value: pagerank },
    { label: 'freshness', value: freshness }
  ]
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginTop: 10
      }}
    >
      {entries.map((e) => (
        <div key={e.label} style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--fg-subtle)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 3
            }}
          >
            {e.label}
          </div>
          <div
            style={{
              height: 4,
              background: 'var(--bg-muted)',
              borderRadius: 999,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${Math.max(2, Math.min(100, e.value * 100))}%`,
                height: '100%',
                background: 'var(--accent)',
                opacity: 0.8
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
