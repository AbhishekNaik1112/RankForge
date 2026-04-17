import { useState } from 'react'
import { recomputePagerank } from '../lib/api'

export function SettingsPage() {
  const [recomputing, setRecomputing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.01em' }}>
          Settings
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>
          Runtime info and maintenance actions
        </p>
      </header>

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
          {recomputing ? 'Recomputing...' : 'Recompute PageRank'}
        </button>
        {message ? (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--fg-secondary)' }}>
            {message}
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
