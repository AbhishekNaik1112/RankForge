import { app, BrowserWindow, dialog, session } from 'electron'
import { join } from 'path'
import { is, optimizer } from '@electron-toolkit/utils'
import { isConfigured } from './config'
import { spawnPython, waitForReady, killPython } from './python'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'RankForge',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    }
  })

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
