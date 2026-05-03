import { spawn, execSync, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { app } from 'electron'
import { join } from 'path'
import { createServer } from 'net'
import { is } from '@electron-toolkit/utils'

import { readConfig } from './config'

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

interface ResolvedPythonCommand {
  command: string
  args: string[]
  backendDir: string
}

/** Resolve which Python entry point to spawn. Pulled out of spawnPython so
 * one-shot tools (e.g. validateDatabaseUrl) can reuse the exact same
 * resolution: bundled exe in production, venv/system Python + run.py in dev. */
async function resolvePythonCommand(): Promise<ResolvedPythonCommand> {
  const backendDir = getBackendDir()
  const bundled = findBundledBackend(backendDir)
  const command = bundled ?? (await findPythonExecutable(backendDir))
  const args = bundled ? [] : ['run.py']
  return { command, args, backendDir }
}

export async function spawnPython(): Promise<void> {
  const port = await findFreePort()
  const { command, args, backendDir } = await resolvePythonCommand()

  pythonPort = port

  // Pull DATABASE_URL from userData/config.json (set by the first-run wizard).
  // In dev, falls through to whatever's in backend/.env via python-dotenv.
  const cfg = await readConfig()

  const env: Record<string, string> = {
    ...process.env,
    HOST: '127.0.0.1',
    PORT: String(port),
    LOG_DIR: join(app.getPath('userData'), 'logs')
  }
  if (cfg.databaseUrl) {
    env.DATABASE_URL = cfg.databaseUrl
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

/** Validate a DATABASE_URL by spawning the same Python entry point with
 * `--validate-db`. Short-circuits before uvicorn/torch load — the bundled
 * exe still has a ~3 s cold-start in production, but that's acceptable for
 * an interactive button. URL goes via env (never argv) to avoid leaking it
 * via the OS process list. */
export async function validateDatabaseUrl(
  url: string
): Promise<{ ok: boolean; error?: string }> {
  if (!url || !url.trim()) {
    return { ok: false, error: 'DATABASE_URL is empty' }
  }

  const { command, args, backendDir } = await resolvePythonCommand()
  const validateArgs = [...args, '--validate-db']

  return new Promise((resolve) => {
    const child = spawn(command, validateArgs, {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: url },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    })

    let stdout = ''
    let stderr = ''
    let done = false

    function finish(result: { ok: boolean; error?: string }): void {
      if (done) return
      done = true
      try {
        child.kill()
      } catch {
        // already exited
      }
      resolve(result)
    }

    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString()
    })
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString()
    })

    child.on('error', (err) => {
      finish({ ok: false, error: err.message || 'Failed to spawn validator' })
    })

    child.on('exit', (code) => {
      // Last non-empty line is the structured marker. The PyInstaller exe may
      // emit warnings/info above it; we scan from the bottom.
      const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      const marker = [...lines].reverse().find(
        (l) => l.startsWith('VALIDATION_OK') || l.startsWith('VALIDATION_ERROR')
      )
      if (marker === 'VALIDATION_OK') {
        finish({ ok: true })
      } else if (marker?.startsWith('VALIDATION_ERROR')) {
        finish({ ok: false, error: marker.replace(/^VALIDATION_ERROR:\s*/, '') })
      } else {
        finish({
          ok: false,
          error:
            stderr.trim() ||
            `Validator exited with code ${code} without a result marker`
        })
      }
    })

    // Hard timeout — psycopg's connect_timeout=8s, plus exe cold-start in
    // production (~3s), plus margin.
    setTimeout(() => {
      finish({ ok: false, error: 'Validation timed out after 15 seconds' })
    }, 15_000)
  })
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
