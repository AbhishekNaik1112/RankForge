import type { SearchResult, GraphData } from '../../../shared/types'

export type { SearchResult }
export type GraphNode = { id: string; title: string }
export type GraphEdge = { from: string; to: string }

export async function searchContent(q: string): Promise<SearchResult[]> {
  return window.api.searchContent(q)
}

export async function getGraph(): Promise<GraphData> {
  return window.api.getGraph()
}
