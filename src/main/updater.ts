/**
 * Auto-update wrapper around electron-updater.
 *
 * Behavior:
 * - Listens to all the events autoUpdater emits and forwards them to the
 *   renderer window via `update-event` IPC. The renderer's UpdateBanner
 *   subscribes through the preload bridge and decides what to show.
 * - Does NOT auto-download. The first event the user sees is "available",
 *   then they click Download, which triggers `downloadUpdate()`. That keeps
 *   the user in control and avoids surprise restarts.
 * - In dev mode, electron-updater is a no-op (no installed app to update).
 *   We still register listeners so manual "Check for updates" returns a
 *   meaningful message instead of crashing.
 */
import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { autoUpdater, type UpdateInfo, type ProgressInfo } from 'electron-updater'

export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string; releaseDate?: string; releaseNotes?: string }
  | { type: 'not-available'; version: string }
  | { type: 'download-progress'; percent: number; transferred: number; total: number }
  | { type: 'downloaded'; version: string }
  | { type: 'error'; message: string }
  | { type: 'dev-mode' }

let initialized = false

function broadcast(event: UpdateEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('update-event', event)
  }
}

export function initAutoUpdater(): void {
  if (initialized) return
  initialized = true

  // We control the download lifecycle from the renderer.
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => broadcast({ type: 'checking' }))
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    broadcast({
      type: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      // releaseNotes can be a string or an array of {note, version} objects
      releaseNotes:
        typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
            ? info.releaseNotes.map((n) => n.note).join('\n\n')
            : undefined
    })
  })
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    broadcast({ type: 'not-available', version: info.version })
  })
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    broadcast({
      type: 'download-progress',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total
    })
  })
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    broadcast({ type: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (err) => {
    broadcast({ type: 'error', message: err?.message ?? 'Update error' })
  })
}

/** Manual check. Returns immediately; results arrive via broadcast events. */
export async function checkForUpdates(): Promise<{ ok: boolean; reason?: string }> {
  if (is.dev) {
    broadcast({ type: 'dev-mode' })
    return { ok: false, reason: 'Auto-update is disabled in development mode.' }
  }
  try {
    await autoUpdater.checkForUpdates()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to check for updates'
    broadcast({ type: 'error', message })
    return { ok: false, reason: message }
  }
}

/** User accepted the update — start the download. */
export async function downloadUpdate(): Promise<{ ok: boolean; reason?: string }> {
  if (is.dev) return { ok: false, reason: 'Disabled in dev' }
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to download update'
    broadcast({ type: 'error', message })
    return { ok: false, reason: message }
  }
}

/** Restart and apply a downloaded update. */
export function quitAndInstall(): void {
  if (is.dev) return
  autoUpdater.quitAndInstall()
}
