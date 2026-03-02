import Link from 'next/link'
import { getSpecimenDetail, getArtistHybridData } from '@/lib/data-service'
import { SoundProfileRadar } from '@/components/sound-profile-radar'
import { ReleaseTimeline, isSkippable } from '@/components/release-timeline'

const MBID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WEB_URL = process.env.WEB_APP_URL ?? 'http://localhost:3000'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ mbid: string }>
}

const LEVEL_LABELS: Record<string, string> = {
  family: 'Sound Family', movement: 'Movement', scene: 'Scene', sound: 'Sound', strain: 'Strain',
}

const FAMILY_HUE_MAP: Record<string, number> = {
  'hip-hop': 35, 'rock': 0, 'jazz': 200,
  'electronic': 270, 'rnb-soul': 320, 'folk-country': 100,
}


const S = {
  sectionHeader: { fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', fontWeight: 600 as const, borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '16px' },
  rule: { border: 'none', borderTop: '1px solid var(--border)', margin: '40px 0 0' } as React.CSSProperties,
  mono: { fontFamily: 'var(--font-mono-custom)', fontSize: '0.68rem', color: 'var(--fg-muted)' } as React.CSSProperties,
}

/** Fetch Spotify image from web app API (same server, instant) when DB imageUrl is null */
async function getSpotifyImage(mbid: string): Promise<string | null> {
  try {
    const res = await fetch(`${WEB_URL}/api/artist/${mbid}`, {
      next: { revalidate: 86400 },
      headers: { 'User-Agent': 'MusicGenus/internal' },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.spotifyData?.images?.[0]?.url ?? data?.imageUrl ?? null
  } catch {
    return null
  }
}

export default async function ArtistPage({ params }: Props) {
  const { mbid } = await params
  // Validate MBID to prevent URL parameter injection
  if (!MBID_RE.test(mbid)) {
    return (
      <main className="g-page">
        <div style={{ padding: '48px 0' }}>
          <Link href="/" style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', textDecoration: 'none' }}>← GENUS</Link>
          <p style={{ marginTop: '32px', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)' }}>Invalid artist ID.</p>
        </div>
      </main>
    )
  }

  const [specimen, hybrid] = await Promise.all([
    getSpecimenDetail(mbid),
    getArtistHybridData(mbid),
  ])

  // Enrich imageUrl from Spotify if not in DB
  const imageUrl = specimen?.imageUrl ?? await getSpotifyImage(mbid)

  if (!specimen) {
    return (
      <main className="g-page">
        <div style={{ padding: '48px 0' }}>
          <Link href="/" style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', letterSpacing: '0.1em', textDecoration: 'none' }}>← GENUS</Link>
          <p style={{ marginTop: '32px', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)' }}>Artist not found.</p>
        </div>
      </main>
    )
  }

  const familyHue = FAMILY_HUE_MAP[specimen.primaryFamilySlug ?? ''] ?? 60

  return (
    <main style={{ minHeight: '100vh' }}>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {imageUrl && (
          <>
            <img src={imageUrl} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(60px)', transform: 'scale(1.2)', opacity: 0.2 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 0%, var(--bg) 100%)' }} />
          </>
        )}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px', margin: '0 auto', padding: '40px 32px 36px', display: 'flex', gap: '28px', alignItems: 'flex-end' }}>
          <div className="g-hero-portrait" style={{ width: '96px', height: '96px', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--border-light)', flexShrink: 0, background: 'var(--bg-3)' }}>
            {imageUrl ? (
              <img src={imageUrl} alt={specimen.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: '2.5rem', color: 'var(--gold)' }}>
                {specimen.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Link href="/" style={{ fontSize: '0.62rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--fg-muted)', textDecoration: 'none', fontFamily: 'var(--font-syne)' }}>GENUS</Link>
              {specimen.lineage.map((seg, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--fg-faint)' }}>›</span>
                  <span style={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)' }}>{seg}</span>
                </span>
              ))}
            </div>
            <h1 className="g-hero-title" style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(26px, 3.5vw, 44px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.0, color: 'var(--fg)', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {specimen.name}
            </h1>
            {(specimen.type || specimen.country) && (
              <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', letterSpacing: '0.05em' }}>
                {[specimen.type, specimen.country].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
        <hr style={{ ...S.rule, margin: 0 }} />
      </div>

      <div className="g-page">

        {/* ── Classification + Radar + Origins ─────────────────────── */}
        <div className="g-3col" style={{ marginTop: '40px' }}>

          {/* Left: Lineage + Sound Signature */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {specimen.classifications.length > 0 && (
              <div>
                <p style={S.sectionHeader}>Lineage</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {specimen.classifications.map(c => (
                    <Link key={c.taxonomyId} href={`/lineage/${c.slug}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.6rem', color: 'var(--fg-faint)', fontFamily: 'var(--font-syne)', letterSpacing: '0.12em', textTransform: 'uppercase', width: '72px', flexShrink: 0 }}>
                        {LEVEL_LABELS[c.level] ?? c.level}
                      </span>
                      <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--fg)', letterSpacing: '-0.01em' }}>
                        {c.name}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {specimen.tags.length > 0 && (
              <div>
                <p style={S.sectionHeader}>Sound Signature</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {specimen.tags.slice(0, 8).map(t => (
                    <span key={t.tag} style={{ fontSize: '0.68rem', padding: '3px 10px', border: '1px solid var(--border)', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', letterSpacing: '0.03em' }}>
                      {t.tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center: Sound Profile radar */}
          <div>
            <p style={{ ...S.sectionHeader, textAlign: 'center' }}>Sound Profile</p>
            {specimen.soundProfile ? (
              <SoundProfileRadar values={specimen.soundProfile} />
            ) : (
              <div style={{ border: '1px solid var(--border)', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', textAlign: 'center', padding: '20px', fontFamily: 'var(--font-syne)' }}>
                  Sound Profile not yet computed.
                </p>
              </div>
            )}
          </div>

          {/* Right: Origins + Related */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            <div>
              <p style={S.sectionHeader}>Origins</p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {specimen.country && (
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 0', fontSize: '0.72rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)' }}>Geography</td>
                      <td style={{ padding: '8px 0', fontSize: '0.72rem', color: 'var(--fg)', fontFamily: 'var(--font-mono-custom)', textAlign: 'right' }}>{specimen.country}</td>
                    </tr>
                  )}
                  {specimen.primaryFamily && (
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 0', fontSize: '0.72rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)' }}>Sound Family</td>
                      <td style={{ padding: '8px 0', textAlign: 'right' }}>
                        <Link href={`/lineage/${specimen.primaryFamilySlug}`} style={{ fontSize: '0.72rem', color: 'var(--gold)', textDecoration: 'none', fontFamily: 'var(--font-syne)', fontWeight: 600 }}>
                          {specimen.primaryFamily}
                        </Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {specimen.relatedSpecimens.length > 0 && (
              <div>
                <p style={S.sectionHeader}>Related Artists</p>
                <div>
                  {specimen.relatedSpecimens.map(rel => (
                    <Link key={rel.mbid} href={`/artist/${rel.mbid}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--fg)', fontFamily: 'var(--font-syne)', fontWeight: 500 }}>{rel.name}</span>
                      {rel.primaryFamily && <span style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', letterSpacing: '0.08em' }}>{rel.primaryFamily}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Connections ──────────────────────────────────────────── */}
        {(hybrid.collaborators.length > 0 || hybrid.samplesFrom.length > 0 || hybrid.sampledBy.length > 0) && (
          <div>
            <hr style={S.rule} />
            <div style={{ marginTop: '40px' }}>
              <p style={S.sectionHeader}>Connections</p>
              <div className="g-connections-grid">

                {hybrid.collaborators.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--fg-faint)', fontFamily: 'var(--font-syne)', fontWeight: 600, marginBottom: '12px' }}>Top Collaborators</p>
                    {hybrid.collaborators.map((a, i) => (
                      <Link key={a.mbid} href={`/artist/${a.mbid}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--fg)', fontFamily: 'var(--font-syne)' }}>{a.name}</span>
                        <span style={{ ...S.mono, fontSize: '0.62rem' }}>{a.count}</span>
                      </Link>
                    ))}
                  </div>
                )}

                {hybrid.samplesFrom.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--fg-faint)', fontFamily: 'var(--font-syne)', fontWeight: 600, marginBottom: '12px' }}>Sampled From</p>
                    {hybrid.samplesFrom.map(r => (
                      <div key={r.mbid} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--fg)', fontFamily: 'var(--font-syne)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                        {r.artistName && <div style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', marginTop: '1px' }}>{r.artistName}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {hybrid.sampledBy.length > 0 && (
                  <div>
                    <p style={{ fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--fg-faint)', fontFamily: 'var(--font-syne)', fontWeight: 600, marginBottom: '12px' }}>Sampled By</p>
                    {hybrid.sampledBy.map(r => (
                      <div key={r.mbid} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--fg)', fontFamily: 'var(--font-syne)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                        {r.artistName && <div style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', marginTop: '1px' }}>{r.artistName}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Releases ─────────────────────────────────────────────── */}
        <ReleasesSection mbid={mbid} familyHue={familyHue} />

      </div>
    </main>
  )
}

async function ReleasesSection({ mbid, familyHue }: { mbid: string; familyHue: number }) {
  const allRgs = await fetch(
    `https://musicbrainz.org/ws/2/release-group?artist=${mbid}&limit=100&fmt=json`,
    { headers: { 'User-Agent': 'MusicGenus/0.1.0 (musicgenus.com)' }, next: { revalidate: 86400 } }
  )
    .then(r => r.ok ? r.json() : null)
    .then(d => (d?.['release-groups'] ?? []) as Array<{ id: string; title: string; 'primary-type'?: string; 'secondary-types'?: string[]; 'first-release-date'?: string }>)
    .catch(() => [])

  const clean = allRgs.filter(rg => !isSkippable(rg))
  if (!clean.length) return null

  const sectionHeader: React.CSSProperties = {
    fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase',
    color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', fontWeight: 600,
    borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '20px',
  }

  return (
    <div>
      {/* Timeline */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '40px 0 0' }} />
      <div style={{ marginTop: '40px', marginBottom: '40px' }}>
        <p style={sectionHeader}>Release Timeline</p>
        <ReleaseTimeline releaseGroups={allRgs} familyHue={familyHue} />
      </div>

      {/* Discography */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0 0 40px' }} />
      <div>
        <p style={sectionHeader}>Discography</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '16px' }}>
          {clean.map(rg => (
            <div key={rg.id}>
              <div style={{ aspectRatio: '1', background: 'var(--bg-3)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '8px' }}>
                <img
                  src={`https://coverartarchive.org/release-group/${rg.id}/front-250`}
                  alt={rg.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-syne)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rg.title}
              </div>
              {rg['first-release-date'] && (
                <div style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono-custom)', marginTop: '2px' }}>
                  {rg['first-release-date'].slice(0, 4)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
