import { FileText, Image as ImageIcon, Sparkles, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowseFilesButton } from '../components/BrowseFilesButton'
import { ResultCard } from '../components/ResultCard'
import { SearchBar } from '../components/SearchBar'
import { searchContent, type SearchResult } from '../lib/api'

interface Props {
  onOpen: (id: string) => void
  onIngest: (files: File[]) => void
}

export function SearchPage({ onOpen, onIngest }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const runSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const items = await searchContent(q)
      setResults(items)
    } catch (err) {
      setResults([])
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [query])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <header style={{ marginBottom: 4 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: '-0.022em',
            lineHeight: 1.15
          }}
        >
          Search Your Knowledge
        </h1>
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: 'var(--fg-muted)',
            maxWidth: 540
          }}
        >
          Hybrid ranking blends semantic meaning, keyword match, graph
          authority &amp; freshness — across every doc, image, and page.
        </p>
      </header>

      <SearchBar
        ref={inputRef}
        value={query}
        onChange={setQuery}
        onSubmit={runSearch}
        loading={loading}
      />

      {error ? (
        <div
          role="alert"
          aria-live="polite"
          style={{
            padding: '11px 14px',
            fontSize: 13,
            color: '#fca5a5',
            background: 'color-mix(in srgb, #ef4444 12%, transparent)',
            border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          {error}
        </div>
      ) : null}

      {!hasSearched && !error ? <DropHint onIngest={onIngest} /> : null}

      {hasSearched && !loading && results.length === 0 && !error ? (
        <NoResults query={query} />
      ) : null}

      {results.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {results.map((r) => (
            <ResultCard key={r.id} result={r} onClick={() => onOpen(r.id)} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Pre-search empty state. Reads as a real drop target. */
function DropHint({ onIngest }: { onIngest: (files: File[]) => void }) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: 'var(--space-10) var(--space-6)',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, transparent), transparent)',
        border: '1.5px dashed var(--border-strong)',
        borderRadius: 'var(--radius-xl)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        textAlign: 'center'
      }}
    >
      <div
        aria-hidden
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--accent-soft)',
          color: 'var(--accent)',
          display: 'grid',
          placeItems: 'center'
        }}
      >
        <Upload size={22} strokeWidth={2} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--fg-primary)' }}>
          Drop files anywhere on the window
        </div>
        <div
          style={{
            margin: '6px 0 0',
            fontSize: 13,
            color: 'var(--fg-muted)',
            maxWidth: 460,
            lineHeight: 1.55
          }}
        >
          Text, Markdown, PDF, Word, PowerPoint, or images. Each gets chunked,
          embedded, and indexed — then search across all of it from this box.
        </div>
      </div>
      <BrowseFilesButton onFilesSelected={onIngest} />
      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          justifyContent: 'center',
          color: 'var(--fg-subtle)',
          fontSize: 12
        }}
      >
        <SupportChip icon={FileText} label=".txt · .md · .pdf" />
        <SupportChip icon={FileText} label=".docx · .pptx" />
        <SupportChip icon={ImageIcon} label=".png · .jpg · .webp" />
      </div>
    </div>
  )
}

function SupportChip({
  icon: Icon,
  label
}: {
  icon: typeof Upload
  label: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 999
      }}
    >
      <Icon size={11} strokeWidth={2} aria-hidden />
      {label}
    </span>
  )
}

/** Post-search empty state — different copy from DropHint. */
function NoResults({ query }: { query: string }) {
  return (
    <div
      style={{
        padding: 'var(--space-10) var(--space-6)',
        textAlign: 'center',
        color: 'var(--fg-muted)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        fontSize: 14
      }}
    >
      <Sparkles
        size={20}
        strokeWidth={1.8}
        aria-hidden
        style={{ display: 'block', margin: '0 auto 10px', color: 'var(--fg-subtle)' }}
      />
      <div style={{ fontSize: 15, color: 'var(--fg-secondary)', fontWeight: 500 }}>
        No results for “{query}”
      </div>
      <div style={{ marginTop: 6 }}>
        Try different words, or drop more files to expand what RankForge can search.
      </div>
    </div>
  )
}
