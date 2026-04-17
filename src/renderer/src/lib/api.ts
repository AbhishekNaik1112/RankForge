import type {
  ContentItem,
  ContentType,
  GraphData,
  GraphEdge,
  GraphNode,
  IngestFilePayload,
  IngestTextPayload,
  SearchResult
} from '../../../shared/types'

export type {
  ContentItem,
  ContentType,
  GraphData,
  GraphEdge,
  GraphNode,
  IngestFilePayload,
  IngestTextPayload,
  SearchResult
}

export const searchContent = (q: string) => window.api.searchContent(q)
export const getGraph = () => window.api.getGraph()
export const listContent = () => window.api.listContent()
export const getContent = (id: string) => window.api.getContent(id)
export const ingestFile = (payload: IngestFilePayload) => window.api.ingestFile(payload)
export const ingestText = (payload: IngestTextPayload) => window.api.ingestText(payload)
export const deleteContent = (id: string) => window.api.deleteContent(id)
export const recomputePagerank = () => window.api.recomputePagerank()
