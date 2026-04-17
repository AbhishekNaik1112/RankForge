import { useEffect, useState } from 'react'
import { GraphView } from '../components/GraphView'
import { getGraph, type GraphData } from '../lib/api'

interface Props {
  refreshKey: number
}

export function GraphPage({ refreshKey }: Props) {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getGraph()
      .then((g) => {
        if (!cancelled) setGraph(g)
      })
      .catch(() => {
        if (!cancelled) setGraph({ nodes: [], edges: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Graph
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>
          {loading
            ? 'Loading graph...'
            : `${graph.nodes.length} nodes, ${graph.edges.length} edges`}
        </p>
      </header>

      <GraphView nodes={graph.nodes} edges={graph.edges} />
    </div>
  )
}
