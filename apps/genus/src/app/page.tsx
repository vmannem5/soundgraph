import Link from 'next/link'
import { getSoundFamilies, getFeaturedSpecimens } from '@/lib/data-service'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [families, featured] = await Promise.all([
    getSoundFamilies(),
    getFeaturedSpecimens(),
  ])

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 32px 64px', maxWidth: '900px', margin: '0 auto', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: '20px', fontFamily: 'var(--font-syne)', fontWeight: 600 }}>
          The Music Classification Archive
        </p>

        <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(56px, 9vw, 104px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 0.92, color: 'var(--fg)', marginBottom: '40px' }}>
          Every sound<br />
          <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>has a lineage.</em>
        </h1>

        <form action="/search" method="get" style={{ display: 'flex', alignItems: 'center', maxWidth: '480px', borderBottom: '2px solid var(--fg)' }}>
          <input
            name="q"
            type="text"
            placeholder="Search artists, movements, sounds…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '12px 0', fontSize: '0.88rem', color: 'var(--fg)', fontFamily: 'var(--font-syne)' }}
          />
          <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 12px 16px', fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', fontFamily: 'var(--font-syne)', fontWeight: 700 }}>
            Search →
          </button>
        </form>
      </section>

      {/* ── Sound Families ───────────────────────────────────────────── */}
      <section style={{ padding: '48px 32px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', fontWeight: 600 }}>Sound Families</p>
          <p style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono-custom)' }}>{families.length} classifications</p>
        </div>

        {families.length === 0 ? (
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', padding: '24px 0' }}>No families seeded.</p>
        ) : (
          <div>
            {families.map((fam, i) => (
              <Link key={fam.slug} href={`/lineage/${fam.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  className="family-row"
                  style={{ display: 'grid', gridTemplateColumns: '2.5rem 1fr auto', alignItems: 'center', gap: '20px', padding: '16px 8px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '0.6rem', color: 'var(--fg-faint)', fontFamily: 'var(--font-mono-custom)', paddingLeft: '4px' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--fg)', display: 'block', lineHeight: 1.05 }}>
                      {fam.name}
                    </span>
                    {fam.description && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', lineHeight: 1.4 }}>
                        {fam.description}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono-custom)', whiteSpace: 'nowrap' }}>
                    {fam.specimenCount.toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Featured Artists ─────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section style={{ padding: '0 32px 72px', maxWidth: '900px', margin: '0 auto' }}>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', fontWeight: 600, marginBottom: '0', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            Featured Artists
          </p>
          <div style={{ display: 'flex', gap: '28px', overflowX: 'auto', paddingTop: '20px', paddingBottom: '4px' }}>
            {featured.map(spec => (
              <Link key={spec.mbid} href={`/artist/${spec.mbid}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '72px' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-light)', background: 'var(--bg-3)', flexShrink: 0 }}>
                    {spec.imageUrl ? (
                      <img src={spec.imageUrl} alt={spec.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: '1.3rem', color: 'var(--gold)' }}>
                        {spec.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-syne)', lineHeight: 1.3 }}>
                      {spec.name.length > 13 ? spec.name.slice(0, 12) + '…' : spec.name}
                    </div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--gold)', fontFamily: 'var(--font-syne)', marginTop: '2px', opacity: 0.75, letterSpacing: '0.05em' }}>
                      {spec.primaryFamily}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <style>{`
        .family-row:hover { background: var(--bg-3); }
        .family-row:hover span:last-child { color: var(--gold); }
      `}</style>
    </main>
  )
}
