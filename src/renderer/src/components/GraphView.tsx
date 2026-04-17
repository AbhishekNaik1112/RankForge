import { useMemo } from 'react'
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow'
import 'reactflow/dist/style.css'

import type { GraphEdge, GraphNode } from '../lib/api'
import { CONTENT_TYPE_META } from '../lib/contentType'

function layoutNodes(nodes: GraphNode[]): Node[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
  const gapX = 240
  const gapY = 120

  return nodes.map((n, idx) => {
    const x = (idx % cols) * gapX
    const y = Math.floor(idx / cols) * gapY
    const color = CONTENT_TYPE_META[n.content_type]?.color ?? 'var(--accent)'

    return {
      id: n.id,
      position: { x, y },
      data: { label: n.title },
      style: {
        padding: '8px 12px',
        borderRadius: 6,
        border: `1px solid ${color}`,
        background: `color-mix(in srgb, ${color} 10%, var(--bg-panel))`,
        color: 'var(--fg-primary)',
        fontSize: 12,
        fontFamily: 'var(--font-sans)',
        maxWidth: 220
      }
    }
  })
}

function toEdges(edges: GraphEdge[]): Edge[] {
  return edges.map((e, idx) => ({
    id: `${e.from}-${e.to}-${idx}`,
    source: e.from,
    target: e.to,
    style: { stroke: 'var(--border-strong)', strokeWidth: 1 }
  }))
}

export function GraphView(props: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const flowNodes = useMemo(() => layoutNodes(props.nodes), [props.nodes])
  const flowEdges = useMemo(() => toEdges(props.edges), [props.edges])

  if (props.nodes.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-12)',
          textAlign: 'center',
          color: 'var(--fg-muted)',
          fontSize: 14,
          border: '1px dashed var(--border-subtle)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        Graph is empty. Ingest content and create links between items.
      </div>
    )
  }

  return (
    <div
      style={{
        height: 'calc(100vh - 180px)',
        minHeight: 480,
        width: '100%',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden'
      }}
    >
      <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
        <Background color="var(--border-subtle)" />
        <Controls />
      </ReactFlow>
    </div>
  )
}
