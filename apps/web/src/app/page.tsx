import Link from 'next/link'
import { getSoundFamilies, getFeaturedSpecimens, getArtistsPerFamily } from '@/lib/data-service'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [families, featured, artistsPerFamily] = await Promise.all([
    getSoundFamilies(),
    getFeaturedSpecimens(),
    getArtistsPerFamily(5),
  ])

  return (
    <main>
      <section style={{ padding: '48px 32px 40px', maxWidth: '900px', margin: '0 auto', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: '14px', fontFamily: 'var(--font-syne)', fontWeight: 600 }}>
          The Music Classification Archive
        </p>

        <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(32px, 5vw, 60px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 0.95, color: 'var(--fg)', marginBottom: '24px' }}>
          Every sound{' '}
          <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>has a lineage.</em>
        </h1>

        <form action="/search" method="get" style={{ display: 'flex', alignItems: 'center', maxWidth: '480px', borderBottom: '2px solid var(--fg)' }}>
          <input
            name="q"
            type="text"
            placeholder="Search artists, movements, sounds…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 0', fontSize: '0.85rem', color: 'var(--fg)', fontFamily: 'var(--font-syne)' }}
          />
          <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0 10px 16px', fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--gold)', fontFamily: 'var(--font-syne)', fontWeight: 700 }}>
            Search →
          </button>
        </form>
      </section>

      <section style={{ padding: '40px 32px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', fontWeight: 600 }}>Sound Families</p>
          <p style={{ fontSize: '0.62rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono-custom)' }}>{families.length} classifications</p>
        </div>

        {families.map((fam, i) => {
          const previews = artistsPerFamily.get(fam.slug) ?? []
          return (
            <Link key={fam.slug} href={`/lineage/${fam.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div
                className="fam-row g-family-row"
              >
                <span style={{ fontSize: '0.58rem', color: 'var(--fg-faint)', fontFamily: 'var(--font-mono-custom)', paddingLeft: '4px' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.55rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--fg)', display: 'block', lineHeight: 1.05 }}>
                      {fam.name}
                    </span>
                    {fam.description && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', lineHeight: 1.4 }}>
                        {fam.description}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {previews.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {previews.slice(0, 4).map((a, j) => (
                        <div
                          key={a.mbid}
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            overflow: 'hidden', border: '2px solid var(--bg)',
                            marginLeft: j === 0 ? 0 : '-8px',
                            background: 'var(--bg-3)', flexShrink: 0,
                            zIndex: previews.length - j,
                            position: 'relative',
                          }}
                        >
                          <img src={a.imageUrl!} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="g-family-row-count" style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono-custom)', whiteSpace: 'nowrap' }}>
                    {fam.specimenCount.toLocaleString()}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}
      </section>

      {featured.length > 0 && (
        <section style={{ padding: '0 32px 64px', maxWidth: '900px', margin: '0 auto' }}>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '20px' }}>
            Featured Artists
          </p>

          <div className="g-featured-grid">
            {featured.map(spec => (
              <Link key={spec.mbid} href={`/artist/${spec.mbid}`} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-light)', background: 'var(--bg-3)', flexShrink: 0, transition: 'transform 0.15s' }}
                    className="artist-thumb"
                  >
                    {spec.imageUrl ? (
                      <img src={spec.imageUrl} alt={spec.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: '1.5rem', color: 'var(--gold)' }}>
                        {spec.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-syne)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                      {spec.name}
                    </div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--gold)', fontFamily: 'var(--font-syne)', marginTop: '2px', opacity: 0.8 }}>
                      {spec.primaryFamily}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {families.slice(0, 3).map(fam => {
            const artists = artistsPerFamily.get(fam.slug) ?? []
            if (artists.length < 3) return null
            return (
              <div key={fam.slug} style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', fontWeight: 600 }}>
                    {fam.name}
                  </span>
                  <Link href={`/lineage/${fam.slug}`} style={{ fontSize: '0.6rem', color: 'var(--gold)', textDecoration: 'none', fontFamily: 'var(--font-syne)', letterSpacing: '0.1em' }}>
                    See all →
                  </Link>
                </div>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                  {artists.map(a => (
                    <Link key={a.mbid} href={`/artist/${a.mbid}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-3)' }}>
                        {a.imageUrl ? (
                          <img src={a.imageUrl} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-cormorant)', fontSize: '1.2rem', color: 'var(--gold)' }}>
                            {a.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '56px' }}>
                        {a.name.split(' ')[0]}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}

      <style>{`
        .fam-row:hover { background: var(--bg-3); }
        .artist-thumb:hover { transform: scale(1.06); }
      `}</style>
    </main>
  )
}
