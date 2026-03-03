import Link from 'next/link'
import { searchSpecimens } from '@/lib/data-service'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''
  const results = query ? await searchSpecimens(query) : []

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px 80px' }}>
      <Link href="/" style={{ fontSize: '0.62rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--fg-muted)', textDecoration: 'none', fontFamily: 'var(--font-syne)' }}>
        ← GENUS
      </Link>

      <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 0.95, color: 'var(--fg)', margin: '20px 0 32px' }}>
        Search Artists
      </h1>

      <form method="get" style={{ display: 'flex', alignItems: 'center', maxWidth: '560px', borderBottom: '2px solid var(--fg)', marginBottom: '40px' }}>
        <input
          name="q"
          type="text"
          defaultValue={query}
          autoFocus
          placeholder="Artist name…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 0', fontSize: '0.9rem', color: 'var(--fg)', fontFamily: 'var(--font-syne)' }}
        />
        <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0 10px 16px', fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', fontFamily: 'var(--font-syne)', fontWeight: 700 }}>
          Search →
        </button>
      </form>

      {query && (
        <div>
          <p style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono-custom)', marginBottom: '16px', letterSpacing: '0.1em' }}>
            {results.length} result{results.length !== 1 ? 's' : ''} — &ldquo;{query}&rdquo;
          </p>

          {results.length === 0 ? (
            <p style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', fontSize: '0.88rem' }}>No artists found.</p>
          ) : (
            <div>
              {results.map(spec => (
                <Link
                  key={spec.mbid}
                  href={`/artist/${spec.mbid}`}
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}
                >
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-3)', flexShrink: 0 }}>
                    {spec.imageUrl ? (
                      <img src={spec.imageUrl} alt={spec.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: '1.1rem', color: 'var(--gold)' }}>
                        {spec.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-syne)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {spec.name}
                    </div>
                    {spec.lineage.length > 0 && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', marginTop: '2px' }}>
                        {spec.lineage.join(' › ')}
                      </div>
                    )}
                  </div>
                  {spec.primaryFamily && (
                    <span style={{ fontSize: '0.6rem', padding: '3px 10px', border: '1px solid var(--border)', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', flexShrink: 0, letterSpacing: '0.08em' }}>
                      {spec.primaryFamily}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
