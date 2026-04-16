import { useEffect, useMemo, useState } from 'react'

import { GraphView } from './components/GraphView'
import { getGraph, searchContent, type SearchResult } from './lib/api'

export function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [graph, setGraph] = useState<{ nodes: { id: string; title: string }[]; edges: { from: string; to: string }[] }>({
    nodes: [],
    edges: []
  })

  useEffect(() => {
    let cancelled = false
    getGraph()
      .then((g) => {
        if (!cancelled) setGraph(g)
      })
      .catch(() => {
        if (!cancelled) setGraph({ nodes: [], edges: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSearch(e: React.FormEvent) {
    e.preventDefault()
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
  }

  const hasResults = useMemo(() => results.length > 0, [results])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold">RankForge</h1>
          <p className="mt-1 text-sm text-foreground/70">
            Hybrid ranking: semantic relevance + PageRank authority
          </p>
        </header>

        <section className="mb-10">
          <form onSubmit={onSearch} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search internal content..."
              className="h-11 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm outline-none focus:border-foreground/30"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
          {error ? (
            <div className="mt-3 text-sm text-foreground/80">
              {error}
            </div>
          ) : null}
        </section>

        <section className="mb-12">
          <h2 className="mb-3 text-lg font-semibold">Ranked Results</h2>
          {!hasResults ? (
            <div className="text-sm text-foreground/70">
              Run a search to see ranked content.
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((r) => (
                <article key={r.id} className="rounded-lg border border-foreground/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{r.title}</h3>
                      <p className="mt-1 text-sm text-foreground/80">
                        {r.body}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-foreground/70">Final score</div>
                      <div className="text-lg font-semibold">{r.final_score.toFixed(3)}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                    <div className="rounded-md bg-foreground/5 p-2">
                      <div className="text-xs text-foreground/70">Semantic similarity</div>
                      <div className="font-medium">{r.semantic_similarity.toFixed(3)}</div>
                    </div>
                    <div className="rounded-md bg-foreground/5 p-2">
                      <div className="text-xs text-foreground/70">PageRank (normalized)</div>
                      <div className="font-medium">{r.pagerank_norm.toFixed(3)}</div>
                    </div>
                    <div className="rounded-md bg-foreground/5 p-2">
                      <div className="text-xs text-foreground/70">Freshness boost</div>
                      <div className="font-medium">{r.freshness_boost.toFixed(3)}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Graph Visualization</h2>
          <GraphView nodes={graph.nodes} edges={graph.edges} />
        </section>
      </main>
    </div>
  )
}
