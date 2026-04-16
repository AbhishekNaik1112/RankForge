import { ipcMain, net } from 'electron'
import { getPythonPort } from './python'

function apiUrl(path: string): string {
  const port = getPythonPort()
  if (!port) throw new Error('Python backend is not running')
  return `http://127.0.0.1:${port}${path}`
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await net.fetch(apiUrl(path))
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Backend ${response.status}: ${text || response.statusText}`)
  }
  return response.json() as Promise<T>
}

export function registerIpcHandlers(): void {
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

  ipcMain.handle('get-health', async () => {
    return apiFetch('/health')
  })

  ipcMain.handle('get-python-status', async () => {
    const port = getPythonPort()
    return { running: port !== null, port }
  })
}
