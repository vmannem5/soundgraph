import Link from 'next/link'
import { getTaxonomyNode, getSoundFamilies, getSpecimensForTaxonomy } from '@/lib/data-service'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

const LEVEL_LABELS: Record<string, string> = {
  family: 'Sound Family', movement: 'Movement', scene: 'Scene', sound: 'Sound', strain: 'Strain',
}

const sectionHeader: React.CSSProperties = {
  fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase',
  color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', fontWeight: 600,
  borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '20px',
}

export default async function LineagePage({ params }: Props) {
  const { slug } = await params
  const node = await getTaxonomyNode(slug)

  if (!node) {
    const families = await getSoundFamilies()
    return (
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 32px' }}>
        <Link href="/" style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', textDecoration: 'none', letterSpacing: '0.1em' }}>← GENUS</Link>
        <p style={{ marginTop: '32px', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)' }}>
          Sound Family &ldquo;{slug}&rdquo; not found.
        </p>
        <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {families.map(f => (
            <Link key={f.slug} href={`/lineage/${f.slug}`} style={{
              fontSize: '0.72rem', padding: '4px 12px', border: '1px solid var(--border)',
              color: 'var(--fg-muted)', textDecoration: 'none', fontFamily: 'var(--font-syne)',
            }}>
              {f.name}
            </Link>
          ))}
        </div>
      </main>
    )
  }

  const artists = await getSpecimensForTaxonomy(node.id)

  // Build breadcrumb
  const breadcrumb: Array<{ name: string; slug: string }> = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = node
  while (current.parent) {
    breadcrumb.unshift({ name: current.parent.name, slug: current.parent.slug })
    current = current.parent
  }

  const childLevel = node.children[0]?.level

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 32px 80px' }}>

      {/* Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <Link href="/" style={{ fontSize: '0.62rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--fg-muted)', textDecoration: 'none', fontFamily: 'var(--font-syne)' }}>GENUS</Link>
        {breadcrumb.map(b => (
          <span key={b.slug} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--fg-faint)' }}>›</span>
            <Link href={`/lineage/${b.slug}`} style={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-muted)', textDecoration: 'none', fontFamily: 'var(--font-syne)' }}>{b.name}</Link>
          </span>
        ))}
        <span style={{ color: 'var(--fg-faint)' }}>›</span>
        <span style={{ fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg)', fontFamily: 'var(--font-syne)', fontWeight: 700 }}>{node.name}</span>
      </nav>

      {/* Header */}
      <div style={{ marginBottom: '40px', paddingBottom: '32px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', fontWeight: 600, marginBottom: '8px' }}>
          {LEVEL_LABELS[node.level] ?? node.level}
        </p>
        <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 0.95, color: 'var(--fg)', marginBottom: '12px' }}>
          {node.name}
        </h1>
        {node.description && (
          <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-syne)', maxWidth: '560px', lineHeight: 1.6 }}>
            {node.description}
          </p>
        )}
        <p style={{ fontSize: '0.68rem', color: 'var(--fg-faint)', fontFamily: 'var(--font-mono-custom)', marginTop: '8px' }}>
          {node.specimenCount.toLocaleString()} artists classified
        </p>
      </div>

      {/* Sub-levels */}
      {node.children.length > 0 && (
        <div style={{ marginBottom: '40px' }}>
          <p style={sectionHeader}>
            {childLevel ? `${LEVEL_LABELS[childLevel] ?? childLevel}s` : 'Sub-categories'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {node.children.map(child => (
              <Link key={child.slug} href={`/lineage/${child.slug}`} style={{ textDecoration: 'none' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'baseline', gap: '6px',
                  padding: '5px 14px', border: '1px solid var(--border)',
                  fontSize: '0.78rem', color: 'var(--fg)', fontFamily: 'var(--font-syne)',
                  transition: 'border-color 0.15s, color 0.15s',
                }}>
                  {child.name}
                  <span style={{ fontSize: '0.6rem', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono-custom)' }}>{child.specimenCount}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Artists grid */}
      <div>
        <p style={sectionHeader}>Artists — sorted by influence</p>
        {artists.length === 0 ? (
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.85rem', fontFamily: 'var(--font-syne)' }}>No artists classified here yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '24px 16px' }}>
            {artists.map((artist, i) => (
              <Link key={artist.mbid} href={`/artist/${artist.mbid}`} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden',
                  border: i < 3 ? '2px solid var(--gold)' : '1px solid var(--border)',
                  background: 'var(--bg-3)', flexShrink: 0,
                  transition: 'border-color 0.2s',
                }}>
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt={artist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-cormorant)', fontWeight: 600, fontSize: '1.4rem',
                      color: `oklch(70% 0.15 ${(artist.name.charCodeAt(0) * 47) % 360})`,
                      background: `oklch(20% 0.04 ${(artist.name.charCodeAt(0) * 47) % 360})`,
                    }}>
                      {artist.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-syne)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '96px' }}>
                    {artist.name}
                  </div>
                  {i < 3 && (
                    <div style={{ fontSize: '0.58rem', color: 'var(--gold)', fontFamily: 'var(--font-syne)', marginTop: '2px', letterSpacing: '0.05em' }}>
                      #{i + 1} influence
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
