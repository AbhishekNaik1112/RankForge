export interface SearchResult {
  id: string
  title: string
  body: string
  semantic_similarity: number
  pagerank_norm: number
  freshness_boost: number
  final_score: number
}

export interface GraphNode {
  id: string
  title: string
}

export interface GraphEdge {
  from: string
  to: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface IpcApi {
  searchContent: (query: string) => Promise<SearchResult[]>
  getGraph: () => Promise<GraphData>
  getHealth: () => Promise<{ ok: boolean }>
  getPythonStatus: () => Promise<{ running: boolean; port: number | null }>
}
