import { useCallback, useEffect, useRef, useState } from 'react'
import { ResultCard } from '../components/ResultCard'
import { SearchBar } from '../components/SearchBar'
import { searchContent, type SearchResult } from '../lib/api'

interface Props {
  onOpen: (id: string) => void
}

export function SearchPage({ onOpen }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const runSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
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
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Search
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>
          Hybrid ranking: semantic meaning + keyword match + authority + freshness
        </p>
      </header>

      <SearchBar
        ref={inputRef}
        value={query}
        onChange={setQuery}
        onSubmit={runSearch}
        loading={loading}
        placeholder="Try 'machine learning' or a concept you've ingested..."
      />

      {error ? (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            fontSize: 13,
            color: '#b91c1c',
            background: 'color-mix(in srgb, #ef4444 10%, var(--bg-panel))',
            border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          {error}
        </div>
      ) : null}

      {!loading && results.length === 0 && !error ? (
        <EmptyHint query={query} />
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

function EmptyHint({ query }: { query: string }) {
  return (
    <div
      style={{
        padding: 'var(--space-12) var(--space-6)',
        textAlign: 'center',
        color: 'var(--fg-muted)',
        border: '1px dashed var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        fontSize: 14
      }}
    >
      {query.trim()
        ? 'No results yet — hit Enter to search.'
        : 'Drop files anywhere on the window, then search across their meaning and keywords.'}
    </div>
  )
}
