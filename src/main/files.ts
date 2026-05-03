import { app } from 'electron'
import { mkdir, readdir, stat, unlink, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

export function getFilesDir(): string {
  return join(app.getPath('userData'), 'files')
}

export interface OrphanScanResult {
  orphans: string[]
  totalBytes: number
}

/** Scan userData/files for files not referenced by `referencedPaths`.
 * The set is built by the caller from the backend's content rows. Returns
 * absolute paths so they can be passed straight to deleteFileIfExists. */
export async function scanOrphanFiles(referencedPaths: Set<string>): Promise<OrphanScanResult> {
  const dir = getFilesDir()
  if (!existsSync(dir)) return { orphans: [], totalBytes: 0 }

  const entries = await readdir(dir)
  const orphans: string[] = []
  let totalBytes = 0
  for (const name of entries) {
    const abs = join(dir, name)
    if (referencedPaths.has(abs)) continue
    try {
      const s = await stat(abs)
      if (s.isFile()) {
        orphans.push(abs)
        totalBytes += s.size
      }
    } catch {
      // race: file disappeared between readdir and stat — skip
    }
  }
  return { orphans, totalBytes }
}

function sanitizeFilename(name: string): string {
  // Keep only safe filesystem characters; replace others with '_'.
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file'
}

export async function saveDroppedFile(
  buffer: ArrayBuffer,
  filename: string
): Promise<string> {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error(
      `File exceeds 50 MB limit (got ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`
    )
  }

  const dir = getFilesDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const safe = sanitizeFilename(filename)
  const absPath = join(dir, `${randomUUID()}-${safe}`)
  await writeFile(absPath, Buffer.from(buffer))
  return absPath
}

export async function deleteFileIfExists(absPath: string | null): Promise<void> {
  if (!absPath) return
  try {
    await unlink(absPath)
  } catch (err) {
    // Ignore missing files; surface other errors only in dev console.
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      console.warn(`[files] Failed to delete ${absPath}:`, err)
    }
  }
}
