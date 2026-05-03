import dagre from '@dagrejs/dagre'
import { Search as SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeMouseHandler
} from 'reactflow'
import 'reactflow/dist/style.css'

import type { ContentType, GraphEdge, GraphNode } from '../lib/api'
import { CONTENT_TYPE_META } from '../lib/contentType'

const NODE_WIDTH = 220
const NODE_HEIGHT = 44

const TYPE_ORDER: ContentType[] = ['text', 'markdown', 'pdf', 'docx', 'pptx', 'image']

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onOpen: (id: string) => void
}

export function GraphView({ nodes, edges, onOpen }: Props) {
  const [activeTypes, setActiveTypes] = useState<Set<ContentType>>(new Set())
  const [search, setSearch] = useState('')

  const visibleNodes = useMemo(() => {
    if (activeTypes.size === 0) return nodes
    return nodes.filter((n) => activeTypes.has(n.content_type))
  }, [nodes, activeTypes])

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes])
  const visibleEdges = useMemo(
    () => edges.filter((e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)),
    [edges, visibleNodeIds]
  )

  const flowNodes = useMemo(
    () => buildFlowNodes(visibleNodes, visibleEdges, search.trim().toLowerCase()),
    [visibleNodes, visibleEdges, search]
  )
  const flowEdges = useMemo(() => toEdges(visibleEdges), [visibleEdges])

  function toggleType(t: ContentType): void {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const handleNodeClick: NodeMouseHandler = (_e, node) => {
    onOpen(node.id)
  }

  if (nodes.length === 0) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TYPE_ORDER.map((t) => (
            <TypeChip
              key={t}
              type={t}
              active={activeTypes.has(t)}
              onToggle={() => toggleType(t)}
            />
          ))}
          {activeTypes.size > 0 ? (
            <button
              type="button"
              onClick={() => setActiveTypes(new Set())}
              style={{
                padding: '5px 11px',
                fontSize: 12,
                color: 'var(--fg-muted)',
                background: 'transparent',
                border: '1px dashed var(--border-subtle)',
                borderRadius: 999,
                cursor: 'pointer'
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            fontSize: 12.5,
            color: 'var(--fg-primary)',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-strong)',
            borderRadius: 999,
            minWidth: 220
          }}
        >
          <SearchIcon size={13} strokeWidth={2} aria-hidden style={{ color: 'var(--fg-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a node…"
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 12.5,
              color: 'var(--fg-primary)',
              fontFamily: 'inherit'
            }}
          />
        </div>
      </div>

      <div
        style={{
          height: 'calc(100vh - 240px)',
          minHeight: 480,
          width: '100%',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}
      >
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          onNodeClick={handleNodeClick}
          nodesDraggable={false}
        >
          <Background color="var(--border-subtle)" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  )
}

function buildFlowNodes(nodes: GraphNode[], edges: GraphEdge[], search: string): Node[] {
  if (nodes.length === 0) return []

  const positions = computeDagrePositions(nodes, edges)

  return nodes.map((n) => {
    const color = CONTENT_TYPE_META[n.content_type]?.color ?? 'var(--accent)'
    const matchesSearch = search === '' || n.title.toLowerCase().includes(search)
    const dimmed = search !== '' && !matchesSearch

    return {
      id: n.id,
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: { label: n.title },
      style: {
        padding: '8px 12px',
        borderRadius: 8,
        border: matchesSearch && search !== ''
          ? `2px solid var(--accent)`
          : `1px solid ${color}`,
        background: `color-mix(in srgb, ${color} 12%, var(--bg-panel))`,
        color: 'var(--fg-primary)',
        fontSize: 12,
        fontFamily: 'var(--font-sans)',
        width: NODE_WIDTH,
        opacity: dimmed ? 0.28 : 1,
        cursor: 'pointer',
        transition: 'opacity 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
        boxShadow:
          matchesSearch && search !== ''
            ? `0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent)`
            : 'none'
      }
    }
  })
}

function computeDagrePositions(
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 90, marginx: 24, marginy: 24 })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((e) => {
    if (g.hasNode(e.from) && g.hasNode(e.to)) g.setEdge(e.from, e.to)
  })

  dagre.layout(g)

  const positions = new Map<string, { x: number; y: number }>()
  nodes.forEach((n) => {
    const node = g.node(n.id)
    if (node) {
      positions.set(n.id, { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 })
    }
  })
  return positions
}

function toEdges(edges: GraphEdge[]): Edge[] {
  return edges.map((e, idx) => ({
    id: `${e.from}-${e.to}-${idx}`,
    source: e.from,
    target: e.to,
    style: { stroke: 'var(--border-strong)', strokeWidth: 1 },
    animated: false
  }))
}

function TypeChip({
  type,
  active,
  onToggle
}: {
  type: ContentType
  active: boolean
  onToggle: () => void
}) {
  const meta = CONTENT_TYPE_META[type]
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px',
        fontSize: 12,
        color: active ? 'var(--fg-on-accent)' : 'var(--fg-secondary)',
        background: active ? 'var(--accent)' : 'var(--bg-panel)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-subtle)'}`,
        borderRadius: 999,
        cursor: 'pointer',
        transition: 'background var(--duration-fast) var(--ease)'
      }}
    >
      <Icon
        size={11}
        strokeWidth={2.2}
        aria-hidden
        style={{ color: active ? 'var(--fg-on-accent)' : meta.color }}
      />
      {meta.label}
    </button>
  )
}
