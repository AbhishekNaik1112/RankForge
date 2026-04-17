import { app } from 'electron'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

function getFilesDir(): string {
  return join(app.getPath('userData'), 'files')
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
