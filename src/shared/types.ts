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
  matched_chunk: string | null
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
  /** Optional caption for image content. Embedded as text chunks so search
   * covers the user's own words. Ignored for non-image types. */
  description?: string | null
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
  getHealth: () => Promise<{ ok: boolean; model_ready?: boolean }>
  getPythonStatus: () => Promise<{ running: boolean; port: number | null }>

  // Diagnostics
  openLogDir: () => Promise<{ ok: boolean; error?: string }>
  findOrphanFiles: () => Promise<{ orphans: string[]; totalBytes: number }>
  deleteOrphanFiles: (paths: string[]) => Promise<{ deleted: number }>

  // First-run setup
  isConfigured: () => Promise<{ configured: boolean; running: boolean }>
  getConfig: () => Promise<{ databaseUrl: string }>
  setupBackend: (payload: {
    databaseUrl: string
  }) => Promise<{ ok: boolean; restartRequired: boolean }>

  // Auto-update
  checkForUpdates: () => Promise<{ ok: boolean; reason?: string }>
  downloadUpdate: () => Promise<{ ok: boolean; reason?: string }>
  quitAndInstall: () => Promise<void>
  onUpdateEvent: (callback: (event: UpdateEvent) => void) => () => void
}

export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string; releaseDate?: string; releaseNotes?: string }
  | { type: 'not-available'; version: string }
  | { type: 'download-progress'; percent: number; transferred: number; total: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
  | { type: 'dev-mode' }
