import { ExternalLink, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { setupBackend } from '../lib/api'
import { BrandMark } from './BrandMark'

interface Props {
  onConfigured: () => void
}

/**
 * First-run wizard. Asks for the Neon DATABASE_URL, saves it to
 * userData/config.json via IPC, and triggers the backend spawn.
 *
 * Validation is intentionally minimal — basic format check only.
 * The real test is whether the backend starts; if it doesn't, we
 * surface the error and let the user re-enter.
 */
export function SetupWizard({ onConfigured }: Props) {
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const looksValid = /^postgres(ql)?:\/\/.+@.+\/.+/.test(url.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!looksValid) {
      setError('Looks like that URL is missing a piece — expected postgresql://user:password@host/dbname')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await setupBackend({ databaseUrl: url.trim() })
      onConfigured()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start the backend'
      setError(message)
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-8)',
        background: 'var(--bg-app)'
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <BrandMark size={42} />
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: '-0.018em'
              }}
            >
              Welcome to RankForge
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 13.5, color: 'var(--fg-muted)' }}>
              One-time setup — connect to your database
            </p>
          </div>
        </div>

        <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--fg-secondary)', lineHeight: 1.6 }}>
          RankForge stores your content metadata in a Postgres database. The free tier of{' '}
          <a
            href="https://neon.tech"
            onClick={(e) => {
              e.preventDefault()
              window.open('https://neon.tech', '_blank')
            }}
            style={{ color: 'var(--accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 2 }}
          >
            Neon <ExternalLink size={12} />
          </a>{' '}
          works great. After creating a project, copy the pooled connection string and paste it below.
        </p>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="db-url"
            style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--fg-secondary)', marginBottom: 6 }}
          >
            DATABASE_URL
          </label>
          <input
            id="db-url"
            type="password"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
            disabled={submitting}
            autoFocus
            spellCheck={false}
            style={{
              width: '100%',
              height: 40,
              padding: '0 12px',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              color: 'var(--fg-primary)',
              background: 'var(--bg-app)',
              border: `1px solid ${error ? '#ef4444' : 'var(--border-strong)'}`,
              borderRadius: 'var(--radius-md)',
              outline: 'none'
            }}
          />
          <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--fg-subtle)' }}>
            Stored locally in <code className="font-mono">userData/config.json</code>. Never sent anywhere except your database.
          </p>

          {error ? (
            <div
              role="alert"
              style={{
                marginTop: 14,
                padding: '10px 14px',
                fontSize: 13,
                color: '#b91c1c',
                background: 'color-mix(in srgb, #ef4444 10%, var(--bg-panel))',
                border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
            <button
              type="submit"
              disabled={submitting || !url.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--fg-on-accent)',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: submitting || !url.trim() ? 'not-allowed' : 'pointer',
                opacity: submitting || !url.trim() ? 0.6 : 1
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="rf-spin" /> Starting backend…
                </>
              ) : (
                'Connect & Start'
              )}
            </button>
          </div>
        </form>

        <p style={{ margin: '24px 0 0', fontSize: 12, color: 'var(--fg-subtle)', lineHeight: 1.6 }}>
          First launch will also download the CLIP model (~600 MB), used for searching across text and images.
          This happens once.
        </p>
      </div>
    </div>
  )
}
