import { Check, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { useSidebarContext } from '../hooks/sidebarContext'
import { useThemeContext } from '../hooks/themeContext'
import { useUpdaterContext } from '../hooks/updaterContext'
import { SIDEBAR_MODE_OPTIONS, type SidebarMode } from '../hooks/useSidebar'
import { THEME_OPTIONS, type ThemePreference } from '../hooks/useTheme'
import {
  deleteOrphanFiles,
  findOrphanFiles,
  openLogDir,
  recomputePagerank,
  restartApp,
  setupBackend,
  validateDatabaseUrl
} from '../lib/api'

type DbTestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

interface DatabaseEditorState {
  editing: boolean
  url: string
  saving: boolean
  test: DbTestState
  saved: boolean
  error: string | null
}

const INITIAL_DB_STATE: DatabaseEditorState = {
  editing: false,
  url: '',
  saving: false,
  test: { kind: 'idle' },
  saved: false,
  error: null
}

interface OrphanState {
  scanning: boolean
  deleting: boolean
  orphans: string[] | null
  totalBytes: number
  message: string | null
}

const INITIAL_ORPHAN_STATE: OrphanState = {
  scanning: false,
  deleting: false,
  orphans: null,
  totalBytes: 0,
  message: null
}

export function SettingsPage() {
  const [recomputing, setRecomputing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [logMessage, setLogMessage] = useState<string | null>(null)
  const [orphanState, setOrphanState] = useState<OrphanState>(INITIAL_ORPHAN_STATE)
  const [dbState, setDbState] = useState<DatabaseEditorState>(INITIAL_DB_STATE)
  const { status: updateStatus, check: checkForUpdates } = useUpdaterContext()
  const { preference: themePref, setPreference: setThemePref } = useThemeContext()
  const { mode: sidebarMode, setMode: setSidebarMode } = useSidebarContext()

  function startEditingDb(): void {
    setDbState({ ...INITIAL_DB_STATE, editing: true })
  }

  function cancelEditingDb(): void {
    setDbState(INITIAL_DB_STATE)
  }

  function handleDbUrlChange(value: string): void {
    setDbState((s) => ({
      ...s,
      url: value,
      // Reset stale test result when URL changes.
      test: s.test.kind === 'idle' ? s.test : { kind: 'idle' },
      saved: false,
      error: null
    }))
  }

  async function handleDbTest(): Promise<void> {
    const trimmed = dbState.url.trim()
    if (!trimmed) return
    setDbState((s) => ({ ...s, test: { kind: 'testing' } }))
    try {
      const result = await validateDatabaseUrl(trimmed)
      setDbState((s) => ({
        ...s,
        test: result.ok
          ? { kind: 'success' }
          : { kind: 'error', message: result.error ?? 'Connection failed' }
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed'
      setDbState((s) => ({ ...s, test: { kind: 'error', message } }))
    }
  }

  async function handleDbSave(): Promise<void> {
    const trimmed = dbState.url.trim()
    if (!trimmed) return
    if (dbState.test.kind === 'error') {
      const proceed = window.confirm(
        `Connection test failed: ${dbState.test.message}\n\nSave anyway? RankForge will fail to start with this URL until it's fixed.`
      )
      if (!proceed) return
    }
    setDbState((s) => ({ ...s, saving: true, error: null }))
    try {
      // Reuses the wizard's setup-backend handler. Returns restartRequired:true
      // when the backend is already running with the old URL — which is always
      // the case here, since Settings is only reachable after first-run.
      await setupBackend({ databaseUrl: trimmed })
      setDbState((s) => ({ ...s, saving: false, saved: true }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save database URL'
      setDbState((s) => ({ ...s, saving: false, error: message }))
    }
  }

  async function handleRestart(): Promise<void> {
    await restartApp()
  }

  async function handleScanOrphans() {
    setOrphanState({ ...INITIAL_ORPHAN_STATE, scanning: true })
    try {
      const result = await findOrphanFiles()
      setOrphanState({
        scanning: false,
        deleting: false,
        orphans: result.orphans,
        totalBytes: result.totalBytes,
        message:
          result.orphans.length === 0
            ? 'No orphan files found.'
            : `Found ${result.orphans.length} orphan file(s) — ${formatMB(result.totalBytes)}.`
      })
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Scan failed'
      setOrphanState({ ...INITIAL_ORPHAN_STATE, message: `Scan failed: ${detail}` })
    }
  }

  async function handleDeleteOrphans() {
    if (!orphanState.orphans || orphanState.orphans.length === 0) return
    if (!window.confirm(`Delete ${orphanState.orphans.length} orphan file(s)?`)) return
    setOrphanState((s) => ({ ...s, deleting: true }))
    try {
      const result = await deleteOrphanFiles(orphanState.orphans)
      setOrphanState({
        ...INITIAL_ORPHAN_STATE,
        message: `Deleted ${result.deleted} orphan file(s).`
      })
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Delete failed'
      setOrphanState((s) => ({ ...s, deleting: false, message: `Delete failed: ${detail}` }))
    }
  }

  async function handleRecompute() {
    setRecomputing(true)
    setMessage(null)
    try {
      const result = await recomputePagerank()
      setMessage(`PageRank updated for ${result.updated} nodes.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'PageRank recompute failed')
    } finally {
      setRecomputing(false)
    }
  }

  async function handleOpenLogs() {
    setLogMessage(null)
    try {
      const result = await openLogDir()
      if (!result.ok && result.error) {
        setLogMessage(`Could not open log folder: ${result.error}`)
      }
    } catch (err) {
      setLogMessage(err instanceof Error ? err.message : 'Failed to open log folder')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>
          Settings
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13.5, color: 'var(--fg-muted)' }}>
          Runtime info and maintenance actions
        </p>
      </header>

      <Section title="Database">
        <DatabaseEditor
          state={dbState}
          onStart={startEditingDb}
          onCancel={cancelEditingDb}
          onUrlChange={handleDbUrlChange}
          onTest={handleDbTest}
          onSave={handleDbSave}
          onRestart={handleRestart}
        />
      </Section>

      <Section title="Appearance">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <ThemeRow value={themePref} onChange={setThemePref} />
          <div style={{ borderTop: '1px solid var(--border-subtle)' }} />
          <SidebarModeRow value={sidebarMode} onChange={setSidebarMode} />
        </div>
      </Section>

      <Section title="Ranking weights">
        <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
          Weights are set via environment variables in <code className="font-mono">backend/.env</code>:
        </p>
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '6px 16px',
            margin: '12px 0 0',
            fontSize: 13
          }}
        >
          <WeightRow name="WEIGHT_SEMANTIC" defaultValue="0.5" desc="Cosine similarity over CLIP embeddings" />
          <WeightRow name="WEIGHT_FTS" defaultValue="0.2" desc="Postgres full-text rank" />
          <WeightRow name="WEIGHT_PAGERANK" defaultValue="0.2" desc="Graph authority (precomputed)" />
          <WeightRow name="WEIGHT_FRESHNESS" defaultValue="0.1" desc="Exponential decay, 30-day half-life" />
        </dl>
      </Section>

      <Section title="Maintenance">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <button
              type="button"
              onClick={handleRecompute}
              disabled={recomputing}
              style={{
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--fg-on-accent)',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: recomputing ? 'wait' : 'pointer',
                opacity: recomputing ? 0.6 : 1
              }}
            >
              {recomputing ? 'Recomputing…' : 'Recompute PageRank'}
            </button>
            {message ? (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--fg-secondary)' }}>
                {message}
              </div>
            ) : null}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <p style={{ margin: '0 0 10px', color: 'var(--fg-muted)', fontSize: 13 }}>
              Find files in <code className="font-mono">userData/files</code> not referenced by
              any content row. Useful after a delete that couldn't unlink the file (e.g., it was
              open in another app).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleScanOrphans}
                disabled={orphanState.scanning || orphanState.deleting}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--fg-primary)',
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-md)',
                  cursor: orphanState.scanning ? 'wait' : 'pointer',
                  opacity: orphanState.scanning ? 0.6 : 1
                }}
              >
                {orphanState.scanning ? 'Scanning…' : 'Find orphan files'}
              </button>
              {orphanState.orphans && orphanState.orphans.length > 0 ? (
                <button
                  type="button"
                  onClick={handleDeleteOrphans}
                  disabled={orphanState.deleting}
                  style={{
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#ffffff',
                    background: '#dc2626',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: orphanState.deleting ? 'wait' : 'pointer',
                    opacity: orphanState.deleting ? 0.6 : 1
                  }}
                >
                  {orphanState.deleting
                    ? 'Deleting…'
                    : `Delete ${orphanState.orphans.length} orphan file(s)`}
                </button>
              ) : null}
            </div>
            {orphanState.message ? (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--fg-secondary)' }}>
                {orphanState.message}
              </div>
            ) : null}
          </div>
        </div>
      </Section>

      <Section title="Updates">
        <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 13 }}>
          RankForge checks for updates from GitHub Releases shortly after launch.
          You can also check now.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
          <button
            type="button"
            onClick={checkForUpdates}
            disabled={updateStatus.kind === 'checking' || updateStatus.kind === 'downloading'}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--fg-primary)',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              cursor:
                updateStatus.kind === 'checking' || updateStatus.kind === 'downloading'
                  ? 'wait'
                  : 'pointer',
              opacity:
                updateStatus.kind === 'checking' || updateStatus.kind === 'downloading' ? 0.6 : 1
            }}
          >
            {updateStatus.kind === 'checking' ? 'Checking…' : 'Check for Updates'}
          </button>
          <UpdateStatusLine status={updateStatus} />
        </div>
      </Section>

      <Section title="Diagnostics">
        <button
          type="button"
          onClick={handleOpenLogs}
          style={{
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--fg-primary)',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer'
          }}
        >
          Open log folder
        </button>
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--fg-muted)' }}>
          Backend logs are written to <code className="font-mono">userData/logs/rankforge.jsonl</code>.
        </p>
        {logMessage ? (
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--fg-secondary)' }}>
            {logMessage}
          </div>
        ) : null}
      </Section>

      <Section title="About">
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '6px 16px',
            margin: 0,
            fontSize: 13
          }}
        >
          <Kv k="Embeddings" v="CLIP ViT-B/32 (512-dim, CPU)" />
          <Kv k="Vector store" v="Neon Postgres + pgvector HNSW" />
          <Kv k="FTS" v="Postgres tsvector + GIN" />
          <Kv k="Graph" v="Batch PageRank (damping 0.85, 30 iterations)" />
        </dl>
      </Section>
    </div>
  )
}

interface DatabaseEditorProps {
  state: DatabaseEditorState
  onStart: () => void
  onCancel: () => void
  onUrlChange: (v: string) => void
  onTest: () => void
  onSave: () => void
  onRestart: () => void
}

function DatabaseEditor({
  state,
  onStart,
  onCancel,
  onUrlChange,
  onTest,
  onSave,
  onRestart
}: DatabaseEditorProps) {
  if (!state.editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
          Database URL:{' '}
          <code className="font-mono" style={{ color: 'var(--fg-primary)' }}>
            ••••configured••••
          </code>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-muted)' }}>
          Stored at <code className="font-mono">userData/config.json</code>. Changing it requires a
          restart so the connection pool re-initializes.
        </p>
        <div>
          <button
            type="button"
            onClick={onStart}
            style={{
              marginTop: 4,
              padding: '7px 14px',
              fontSize: 12.5,
              fontWeight: 500,
              color: 'var(--fg-primary)',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  if (state.saved) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
          Database URL saved. Restart RankForge to apply — the new connection pool initializes at
          startup.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onRestart}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--fg-on-accent)',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}
          >
            Restart now
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--fg-secondary)',
              background: 'transparent',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer'
            }}
          >
            Restart later
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        type="password"
        value={state.url}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder="postgresql://user:password@host/dbname?sslmode=require"
        autoFocus
        spellCheck={false}
        disabled={state.saving}
        style={{
          width: '100%',
          height: 38,
          padding: '0 12px',
          fontSize: 12.5,
          fontFamily: 'var(--font-mono)',
          color: 'var(--fg-primary)',
          background: 'var(--bg-app)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          outline: 'none'
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onTest}
          disabled={!state.url.trim() || state.test.kind === 'testing' || state.saving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 14px',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--fg-primary)',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            cursor:
              !state.url.trim() || state.test.kind === 'testing' || state.saving
                ? 'not-allowed'
                : 'pointer',
            opacity:
              !state.url.trim() || state.test.kind === 'testing' || state.saving ? 0.6 : 1
          }}
        >
          {state.test.kind === 'testing' ? <Loader2 size={13} className="rf-spin" /> : null}
          {state.test.kind === 'testing' ? 'Testing…' : 'Test connection'}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!state.url.trim() || state.saving || state.test.kind === 'testing'}
          style={{
            padding: '7px 14px',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--fg-on-accent)',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor:
              !state.url.trim() || state.saving || state.test.kind === 'testing'
                ? 'not-allowed'
                : 'pointer',
            opacity:
              !state.url.trim() || state.saving || state.test.kind === 'testing' ? 0.6 : 1
          }}
        >
          {state.saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={state.saving}
          style={{
            padding: '7px 14px',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--fg-secondary)',
            background: 'transparent',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            cursor: state.saving ? 'not-allowed' : 'pointer',
            opacity: state.saving ? 0.6 : 1
          }}
        >
          Cancel
        </button>
        <DbTestResultLine state={state.test} />
      </div>
      {state.error ? (
        <div role="alert" style={{ fontSize: 12.5, color: '#dc2626' }}>
          {state.error}
        </div>
      ) : null}
    </div>
  )
}

function DbTestResultLine({ state }: { state: DbTestState }) {
  if (state.kind === 'idle' || state.kind === 'testing') return null
  if (state.kind === 'success') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 12.5,
          color: '#16a34a'
        }}
      >
        <Check size={13} strokeWidth={2.4} /> Connected
      </span>
    )
  }
  return (
    <span
      role="alert"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12.5,
        color: '#dc2626',
        maxWidth: 360,
        wordBreak: 'break-word'
      }}
    >
      <X size={13} strokeWidth={2.4} style={{ flexShrink: 0 }} /> {state.message}
    </span>
  )
}

function formatMB(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function ThemeRow({
  value,
  onChange
}: {
  value: ThemePreference
  onChange: (v: ThemePreference) => void
}) {
  const active = THEME_OPTIONS.find((t) => t.id === value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--fg-primary)' }}>Theme</div>
        <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 3 }}>
          {active?.hint ?? 'Switch the entire UI palette'}
        </div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ThemePreference)}
        style={{
          padding: '7px 12px',
          fontSize: 13,
          color: 'var(--fg-primary)',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          minWidth: 160
        }}
      >
        {THEME_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function SidebarModeRow({
  value,
  onChange
}: {
  value: SidebarMode
  onChange: (v: SidebarMode) => void
}) {
  const active = SIDEBAR_MODE_OPTIONS.find((o) => o.id === value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--fg-primary)' }}>Sidebar</div>
        <div style={{ fontSize: 12.5, color: 'var(--fg-muted)', marginTop: 3 }}>
          {active?.hint ?? 'Choose how the sidebar behaves'}
        </div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SidebarMode)}
        style={{
          padding: '7px 12px',
          fontSize: 13,
          color: 'var(--fg-primary)',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          minWidth: 180
        }}
      >
        {SIDEBAR_MODE_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        padding: 'var(--space-5)',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      <h2 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: 'var(--fg-primary)' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function WeightRow({ name, defaultValue, desc }: { name: string; defaultValue: string; desc: string }) {
  return (
    <>
      <dt style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>
        {name}
      </dt>
      <dd style={{ margin: 0, color: 'var(--fg-muted)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-primary)' }}>{defaultValue}</span>
        <span style={{ margin: '0 8px', color: 'var(--fg-subtle)' }}>·</span>
        {desc}
      </dd>
    </>
  )
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt style={{ color: 'var(--fg-muted)' }}>{k}</dt>
      <dd style={{ margin: 0, color: 'var(--fg-secondary)' }}>{v}</dd>
    </>
  )
}

function UpdateStatusLine({
  status
}: {
  status: ReturnType<typeof useUpdaterContext>['status']
}) {
  let text: string | null = null
  let color = 'var(--fg-muted)'
  switch (status.kind) {
    case 'idle':
      text = null
      break
    case 'checking':
      text = 'Checking GitHub Releases…'
      break
    case 'available':
      text = `Version ${status.version} available — see banner above.`
      color = 'var(--fg-secondary)'
      break
    case 'not-available':
      text = `You're on the latest version (${status.version}).`
      break
    case 'downloading':
      text = `Downloading ${status.percent}%`
      color = 'var(--fg-secondary)'
      break
    case 'downloaded':
      text = `Update ready — restart to install ${status.version}.`
      color = 'var(--fg-secondary)'
      break
    case 'error':
      text = `Update failed: ${status.message}`
      color = '#fca5a5'
      break
    case 'dev-mode':
      text = 'Auto-update is disabled in development mode.'
      break
  }
  if (!text) return null
  return <span style={{ fontSize: 12.5, color }}>{text}</span>
}
