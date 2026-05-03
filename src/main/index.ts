import { app, BrowserWindow, dialog, Menu, session } from 'electron'
import { join } from 'path'
import { is, optimizer } from '@electron-toolkit/utils'
import { isConfigured } from './config'
import { spawnPython, waitForReady, killPython } from './python'
import { registerIpcHandlers } from './ipc'
import { checkForUpdates, initAutoUpdater } from './updater'

let mainWindow: BrowserWindow | null = null

function getIconPath(): string | undefined {
  // In dev: resources/icon.png at the repo root.
  // In production: electron-builder copies build resources into the app's
  // resources folder; the icon ends up alongside the renderer assets.
  if (is.dev) {
    return join(app.getAppPath(), 'resources', 'icon.png')
  }
  // electron-builder bakes the icon into the executable on Windows; we still
  // pass the bundled resource path as a fallback for the runtime icon.
  const bundled = join(process.resourcesPath, 'icon.png')
  return bundled
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 880,
    minHeight: 600,
    title: 'RankForge',
    show: false,
    backgroundColor: '#0a0a0b',
    icon: getIconPath(),
    autoHideMenuBar: true,  // tap Alt to reveal if anyone needs it
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  })

  // Drop the default Electron application menu (File / Edit / View / Window /
  // Help). It's generic noise for a focused single-window app.
  win.setMenu(null)

  // Defensive: in production, swallow F12 / Ctrl+Shift+I / Cmd+Option+I so
  // DevTools can't be opened by accident or by a curious user. The default
  // Electron menu accelerators are already gone via setMenu(null) and the
  // dev shortcut handler is gated by is.dev — this is belt-and-suspenders
  // for any future Electron version that flips a default.
  if (!is.dev) {
    win.webContents.on('before-input-event', (event, input) => {
      const isF12 = input.key === 'F12'
      const isInspector =
        (input.control || input.meta) && input.shift && (input.key === 'I' || input.key === 'i')
      if (isF12 || isInspector) {
        event.preventDefault()
      }
    })
  }

  win.on('ready-to-show', () => {
    win.show()
  })

  // Set Content Security Policy
  // In dev mode, Vite's HMR requires 'unsafe-inline' and 'unsafe-eval' for scripts,
  // plus connect-src to the dev server and websocket for hot reload.
  // In production, we lock down to 'self' only.
  if (!is.dev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'"
          ]
        }
      })
    })
  }

  // Load renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(async () => {
  // Drop the default app menu globally too (Electron may apply it before
  // any window-level setMenu(null) runs on macOS).
  Menu.setApplicationMenu(null)

  // Optimize DevTools shortcuts in dev mode
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers before creating window
  registerIpcHandlers()

  // First-run flow: if no DATABASE_URL is configured yet, skip the Python
  // spawn — open the window straight to the setup wizard. The renderer
  // calls window.api.setupBackend(url) when the user submits, which writes
  // config.json and spawns Python at that point.
  const configured = await isConfigured()
  if (configured) {
    try {
      console.log('[main] Starting Python backend...')
      await spawnPython()
      await waitForReady()
      console.log('[main] Python backend is ready')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error starting backend'
      console.error('[main]', message)
      dialog.showErrorBox(
        'Backend Error',
        `Failed to start the Python backend.\n\n${message}\n\nIf this is the first launch after a config change, the DATABASE_URL may be invalid — open Settings to update it, or delete config.json in your userData directory to re-run the setup wizard.`
      )
      app.quit()
      return
    }
  } else {
    console.log('[main] No DATABASE_URL configured — showing setup wizard.')
  }

  // Create main window
  mainWindow = createWindow()

  // Open DevTools in development
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  // Wire up auto-update event broadcasting now that the window exists.
  // Schedule a check ~10s after launch so it doesn't compete with startup
  // I/O. Skipped in dev (no installed app to update).
  initAutoUpdater()
  if (!is.dev) {
    setTimeout(() => {
      void checkForUpdates()
    }, 10_000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  killPython()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  killPython()
})
