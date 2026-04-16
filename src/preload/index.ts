import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/types'

const api: IpcApi = {
  searchContent: (query: string) => ipcRenderer.invoke('search-content', query),
  getGraph: () => ipcRenderer.invoke('get-graph'),
  getHealth: () => ipcRenderer.invoke('get-health'),
  getPythonStatus: () => ipcRenderer.invoke('get-python-status')
}

contextBridge.exposeInMainWorld('api', api)
