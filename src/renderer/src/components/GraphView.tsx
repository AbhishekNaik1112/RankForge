import { useMemo } from 'react'
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow'
import 'reactflow/dist/style.css'

import type { GraphEdge, GraphNode } from '../lib/api'

function layoutNodes(nodes: GraphNode[]): Node[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
  const gapX = 220
  const gapY = 120

  return nodes.map((n, idx) => {
    const x = (idx % cols) * gapX
    const y = Math.floor(idx / cols) * gapY

    return {
      id: n.id,
      position: { x, y },
      data: { label: n.title }
    }
  })
}

function toEdges(edges: GraphEdge[]): Edge[] {
  return edges.map((e, idx) => ({
    id: `${e.from}-${e.to}-${idx}`,
    source: e.from,
    target: e.to
  }))
}

export function GraphView(props: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const flowNodes = useMemo(() => layoutNodes(props.nodes), [props.nodes])
  const flowEdges = useMemo(() => toEdges(props.edges), [props.edges])

  if (props.nodes.length === 0) {
    return (
      <div className="text-sm text-foreground/70">Graph is empty.</div>
    )
  }

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-lg border border-foreground/10">
      <ReactFlow nodes={flowNodes} edges={flowEdges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
