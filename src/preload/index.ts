import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  IngestFilePayload,
  IngestTextPayload,
  IpcApi,
  UpdateEvent
} from '../shared/types'

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
  getPythonStatus: () => ipcRenderer.invoke('get-python-status'),

  openLogDir: () => ipcRenderer.invoke('open-log-dir'),
  findOrphanFiles: () => ipcRenderer.invoke('find-orphan-files'),
  deleteOrphanFiles: (paths: string[]) => ipcRenderer.invoke('delete-orphan-files', paths),

  isConfigured: () => ipcRenderer.invoke('is-configured'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  setupBackend: (payload) => ipcRenderer.invoke('setup-backend', payload),

  // Auto-update — manual triggers + a subscribe method that returns an
  // unsubscribe fn. The renderer hook calls onUpdateEvent in useEffect
  // and uses the returned cleanup to detach.
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateEvent: (callback: (event: UpdateEvent) => void) => {
    const handler = (_e: IpcRendererEvent, payload: UpdateEvent) => callback(payload)
    ipcRenderer.on('update-event', handler)
    return () => ipcRenderer.removeListener('update-event', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
