import Link from 'next/link'
import { getTaxonomyNode, getSoundFamilies, getSpecimensForTaxonomy } from '@/lib/data-service'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

const LEVEL_LABELS: Record<string, string> = {
  family: 'Sound Family', movement: 'Movement', scene: 'Scene', sound: 'Sound', strain: 'Strain',
}

export default async function LineagePage({ params }: Props) {
  const { slug } = await params
  const node = await getTaxonomyNode(slug)

  if (!node) {
    const families = await getSoundFamilies()
    return (
      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to GENUS</Link>
        <p className="mt-8 text-muted-foreground">Sound Family &ldquo;{slug}&rdquo; not found.</p>
        <div className="mt-4 flex gap-2 flex-wrap">
          {families.map(f => (
            <Link key={f.slug} href={`/lineage/${f.slug}`} className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent">
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
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-foreground">GENUS</Link>
        {breadcrumb.map(b => (
          <span key={b.slug} className="flex items-center gap-1.5">
            <span>›</span>
            <Link href={`/lineage/${b.slug}`} className="hover:text-foreground">{b.name}</Link>
          </span>
        ))}
        <span>›</span>
        <span className="font-semibold text-foreground">{node.name}</span>
      </nav>

      {/* Header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {LEVEL_LABELS[node.level] ?? node.level}
        </div>
        <h1 className="text-4xl font-black" style={{ color: 'var(--genus-gold)' }}>{node.name}</h1>
        {node.description && <p className="text-muted-foreground mt-2 max-w-xl">{node.description}</p>}
        <p className="text-sm text-muted-foreground mt-1">{node.specimenCount} artists</p>
      </div>

      {/* Sub-levels */}
      {node.children.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {childLevel ? `${LEVEL_LABELS[childLevel] ?? childLevel}s` : 'Sub-categories'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {node.children.map(child => (
              <Link
                key={child.slug}
                href={`/lineage/${child.slug}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                {child.name}
                <span className="ml-1.5 text-xs text-muted-foreground">{child.specimenCount}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Artists */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Artists</h2>
        {artists.length === 0 ? (
          <p className="text-sm text-muted-foreground">No artists classified here yet.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {artists.map((artist, i) => (
              <Link
                key={artist.mbid}
                href={`/artist/${artist.mbid}`}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden bg-muted ring-2 ring-transparent group-hover:ring-[var(--genus-gold)] transition-all">
                  {artist.imageUrl ? (
                    <img src={artist.imageUrl} alt={artist.name} className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-lg font-bold"
                      style={{ background: `oklch(30% 0.05 ${(artist.name.charCodeAt(0) * 37) % 360})`, color: `oklch(75% 0.18 ${(artist.name.charCodeAt(0) * 37) % 360})` }}
                    >
                      {artist.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="text-xs font-medium text-center truncate w-full group-hover:text-primary transition-colors">{artist.name}</div>
                {i < 3 && (
                  <div className="text-xs text-muted-foreground -mt-1" style={{ color: 'var(--genus-gold)', opacity: 0.7 }}>
                    #{i + 1} influence
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
