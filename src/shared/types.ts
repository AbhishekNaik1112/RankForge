export type ContentType =
  | 'text'
  | 'markdown'
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'image'

export interface ContentItem {
  id: string
  title: string
  body: string | null
  content_type: ContentType
  source_path: string | null
  mime_type: string | null
  file_size: number | null
  thumbnail_path: string | null
}

export interface SearchResult extends ContentItem {
  semantic_similarity: number
  keyword_match: number
  pagerank_norm: number
  freshness_boost: number
  final_score: number
}

export interface GraphNode {
  id: string
  title: string
  content_type: ContentType
}

export interface GraphEdge {
  from: string
  to: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface IngestFilePayload {
  /** Raw bytes of the dropped file. Sent as ArrayBuffer across IPC. */
  buffer: ArrayBuffer
  filename: string
  /** Optional display title; falls back to filename stem. */
  title?: string
}

export interface IngestTextPayload {
  title: string
  body: string
}

export interface IpcApi {
  // Ingestion
  ingestFile: (payload: IngestFilePayload) => Promise<ContentItem>
  ingestText: (payload: IngestTextPayload) => Promise<ContentItem>

  // Read
  listContent: () => Promise<ContentItem[]>
  getContent: (id: string) => Promise<ContentItem>
  searchContent: (query: string) => Promise<SearchResult[]>
  getGraph: () => Promise<GraphData>

  // Mutate
  deleteContent: (id: string) => Promise<{ ok: boolean }>
  recomputePagerank: () => Promise<{ updated: number }>

  // Status
  getHealth: () => Promise<{ ok: boolean }>
  getPythonStatus: () => Promise<{ running: boolean; port: number | null }>
}
