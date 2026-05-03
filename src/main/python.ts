import { spawn, execSync, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { app } from 'electron'
import { join } from 'path'
import { createServer } from 'net'
import { is } from '@electron-toolkit/utils'

let pythonProcess: ChildProcess | null = null
let pythonPort: number | null = null

function getBackendDir(): string {
  if (is.dev) {
    return join(app.getAppPath(), 'backend')
  }
  // Packaged: extraResources copies the PyInstaller dist folder here.
  return join(process.resourcesPath, 'backend')
}

/** Look for the PyInstaller-bundled backend exe shipped in production builds. */
function findBundledBackend(backendDir: string): string | null {
  if (process.platform !== 'win32') return null  // Win-only for now
  const candidate = join(backendDir, 'rankforge_backend.exe')
  return existsSync(candidate) ? candidate : null
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address && typeof address !== 'string') {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('Could not find free port')))
      }
    })
    server.on('error', reject)
  })
}

function findVenvPython(backendDir: string): string | null {
  // Check for .venv inside backend/ first, then project root
  const candidates = process.platform === 'win32'
    ? [
        join(backendDir, '.venv', 'Scripts', 'python.exe'),
        join(backendDir, '..', '.venv', 'Scripts', 'python.exe')
      ]
    : [
        join(backendDir, '.venv', 'bin', 'python'),
        join(backendDir, '..', '.venv', 'bin', 'python')
      ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      console.log(`[backend] Found venv Python: ${candidate}`)
      return candidate
    }
  }
  return null
}

async function findPythonExecutable(backendDir: string): Promise<string> {
  // Prefer venv Python so backend dependencies are available
  const venvPython = findVenvPython(backendDir)
  if (venvPython) return venvPython

  // Fall back to system Python
  const candidates = process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python']

  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'pipe' })
      console.log(`[backend] Using system Python: ${cmd}`)
      return cmd
    } catch {
      continue
    }
  }

  throw new Error(
    'Python not found. Please install Python 3.9+ and ensure it is on your PATH, ' +
    'or create a virtual environment at backend/.venv with dependencies installed.'
  )
}

export async function spawnPython(): Promise<void> {
  const port = await findFreePort()
  const backendDir = getBackendDir()

  // Production: use the PyInstaller-bundled exe (no Python on PATH needed).
  // Development: fall back to a venv/system Python running run.py.
  const bundled = findBundledBackend(backendDir)
  const command = bundled ?? (await findPythonExecutable(backendDir))
  const args = bundled ? [] : ['run.py']

  pythonPort = port

  const env = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    LOG_DIR: join(app.getPath('userData'), 'logs')
  }

  pythonProcess = spawn(command, args, {
    cwd: backendDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  })

  pythonProcess.stdout?.on('data', (data: Buffer) => {
    console.log(`[backend] ${data.toString().trim()}`)
  })

  pythonProcess.stderr?.on('data', (data: Buffer) => {
    console.log(`[backend] ${data.toString().trim()}`)
  })

  pythonProcess.on('exit', (code) => {
    console.log(`[backend] Python process exited with code ${code}`)
    pythonProcess = null
  })

  pythonProcess.on('error', (err) => {
    console.error(`[backend] Failed to start Python process:`, err.message)
    pythonProcess = null
  })
}

export async function waitForReady(timeoutMs = 120_000): Promise<void> {
  if (!pythonPort) throw new Error('Python not spawned yet')

  const url = `http://127.0.0.1:${pythonPort}/health`
  const start = Date.now()
  let httpReachable = false

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        const body = (await response.json()) as { ok?: boolean; model_ready?: boolean }
        if (!httpReachable) {
          httpReachable = true
          console.log(`[backend] HTTP up on port ${pythonPort}; waiting for AI model...`)
        }
        if (body.model_ready) {
          console.log(`[backend] Ready on port ${pythonPort}`)
          return
        }
      }
    } catch {
      // Not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(
    `Backend did not become ready within ${timeoutMs / 1000}s. ` +
    'On first launch this can happen while the CLIP model downloads (~600 MB). ' +
    'Pre-download with: python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer(\'clip-ViT-B-32\')"'
  )
}

export function getPythonPort(): number | null {
  return pythonPort
}

export function isPythonRunning(): boolean {
  return pythonProcess !== null && !pythonProcess.killed
}

let isShuttingDown = false

export function killPython(): void {
  if (!pythonProcess || isShuttingDown) return
  isShuttingDown = true

  console.log('[backend] Shutting down Python process...')

  // Wire cleanup before signaling so we never miss the exit notification.
  let forceKillTimer: NodeJS.Timeout | undefined
  pythonProcess.on('exit', () => {
    if (forceKillTimer) clearTimeout(forceKillTimer)
    pythonProcess = null
    pythonPort = null
    isShuttingDown = false
  })

  if (process.platform === 'win32') {
    // Windows: use taskkill to ensure the process tree is killed
    spawn('taskkill', ['/pid', String(pythonProcess.pid), '/f', '/t'], {
      stdio: 'ignore',
      shell: true
    })
  } else {
    pythonProcess.kill('SIGTERM')
  }

  // Force kill after 5 seconds if still alive
  forceKillTimer = setTimeout(() => {
    if (pythonProcess && !pythonProcess.killed) {
      console.log('[backend] Force killing Python process...')
      pythonProcess.kill('SIGKILL')
    }
  }, 5000)
}
