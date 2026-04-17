import { ipcMain, net } from 'electron'
import { getPythonPort } from './python'
import { saveDroppedFile } from './files'
import type { IngestFilePayload, IngestTextPayload } from '../shared/types'

function apiUrl(path: string): string {
  const port = getPythonPort()
  if (!port) throw new Error('Python backend is not running')
  return `http://127.0.0.1:${port}${path}`
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await net.fetch(apiUrl(path), init)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Backend ${response.status}: ${text || response.statusText}`)
  }
  return response.json() as Promise<T>
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

export function registerIpcHandlers(): void {
  // Ingestion
  ipcMain.handle('ingest-file', async (_event, payload: IngestFilePayload) => {
    if (!payload?.filename || !payload?.buffer) {
      throw new Error('ingest-file requires { buffer, filename }')
    }
    const sourcePath = await saveDroppedFile(payload.buffer, payload.filename)
    const title = payload.title ?? payload.filename.replace(/\.[^.]+$/, '')
    return apiFetch('/content/ingest', jsonRequest('POST', {
      source_path: sourcePath,
      title
    }))
  })

  ipcMain.handle('ingest-text', async (_event, payload: IngestTextPayload) => {
    if (!payload?.title?.trim() || !payload?.body?.trim()) {
      throw new Error('ingest-text requires non-empty title and body')
    }
    return apiFetch('/content/paste', jsonRequest('POST', {
      title: payload.title,
      body: payload.body
    }))
  })

  // Read
  ipcMain.handle('list-content', async () => {
    return apiFetch('/content')
  })

  ipcMain.handle('get-content', async (_event, id: string) => {
    return apiFetch(`/content/${encodeURIComponent(id)}`)
  })

  ipcMain.handle('search-content', async (_event, query: string) => {
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new Error('Search query must be a non-empty string')
    }
    const params = new URLSearchParams({ q: query.trim() })
    return apiFetch(`/content/search?${params}`)
  })

  ipcMain.handle('get-graph', async () => {
    return apiFetch('/graph')
  })

  // Mutate
  ipcMain.handle('delete-content', async (_event, id: string) => {
    return apiFetch(`/content/${encodeURIComponent(id)}`, { method: 'DELETE' })
  })

  ipcMain.handle('recompute-pagerank', async () => {
    return apiFetch('/jobs/pagerank', { method: 'POST' })
  })

  // Status
  ipcMain.handle('get-health', async () => {
    return apiFetch('/health')
  })

  ipcMain.handle('get-python-status', async () => {
    const port = getPythonPort()
    return { running: port !== null, port }
  })
}
