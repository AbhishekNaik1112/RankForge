/**
 * App configuration persisted in userData/config.json.
 *
 * Currently stores only DATABASE_URL — the Neon connection string the user
 * enters via the first-run setup wizard. Loaded once at startup; written when
 * the user saves the wizard. The Python sidecar reads it via env.
 */
import { app } from 'electron'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

import { is } from '@electron-toolkit/utils'

export interface AppConfig {
  databaseUrl?: string
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

export async function readConfig(): Promise<AppConfig> {
  const path = configPath()
  if (!existsSync(path)) return {}
  try {
    const raw = await readFile(path, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') {
      return parsed as AppConfig
    }
    return {}
  } catch {
    // Corrupt file — treat as missing. The user will see the wizard
    // and re-enter their URL.
    return {}
  }
}

export async function writeConfig(patch: Partial<AppConfig>): Promise<void> {
  const path = configPath()
  await mkdir(dirname(path), { recursive: true })
  const current = await readConfig()
  const merged = { ...current, ...patch }
  await writeFile(path, JSON.stringify(merged, null, 2), 'utf-8')
}

export async function isConfigured(): Promise<boolean> {
  const cfg = await readConfig()
  if (cfg.databaseUrl && cfg.databaseUrl.trim()) return true

  // Dev fallback: a populated backend/.env counts as configured. The Python
  // sidecar will pick up DATABASE_URL via python-dotenv at startup.
  // (In production builds the .env is excluded — see electron-builder.yml.)
  if (is.dev) {
    const envPath = join(app.getAppPath(), 'backend', '.env')
    if (existsSync(envPath)) {
      try {
        const content = await readFile(envPath, 'utf-8')
        if (/^DATABASE_URL\s*=\s*\S+/m.test(content)) {
          return true
        }
      } catch {
        // unreadable — fall through to "not configured"
      }
    }
  }
  return false
}
