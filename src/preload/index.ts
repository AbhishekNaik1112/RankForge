import { contextBridge, ipcRenderer } from 'electron'
import type { IngestFilePayload, IngestTextPayload, IpcApi } from '../shared/types'

const api: IpcApi = {
  ingestFile: (payload: IngestFilePayload) => ipcRenderer.invoke('ingest-file', payload),
  ingestText: (payload: IngestTextPayload) => ipcRenderer.invoke('ingest-text', payload),

  listContent: () => ipcRenderer.invoke('list-content'),
  getContent: (id: string) => ipcRenderer.invoke('get-content', id),
  searchContent: (query: string) => ipcRenderer.invoke('search-content', query),
  getGraph: () => ipcRenderer.invoke('get-graph'),

  deleteContent: (id: string) => ipcRenderer.invoke('delete-content', id),
  recomputePagerank: () => ipcRenderer.invoke('recompute-pagerank'),

  getHealth: () => ipcRenderer.invoke('get-health'),
  getPythonStatus: () => ipcRenderer.invoke('get-python-status')
}

contextBridge.exposeInMainWorld('api', api)
