import Link from 'next/link'
import { getSoundFamilies, getFeaturedSpecimens } from '@/lib/data-service'

export const dynamic = 'force-dynamic'

const FAMILY_COLORS: Record<string, { hue: number }> = {
  'hip-hop':      { hue: 35  },
  'rock':         { hue: 0   },
  'jazz':         { hue: 200 },
  'electronic':   { hue: 270 },
  'rnb-soul':     { hue: 320 },
  'folk-country': { hue: 100 },
}

function familyColor(slug: string) {
  const h = FAMILY_COLORS[slug]?.hue ?? 60
  return {
    border: `oklch(65% 0.18 ${h})`,
    bg:     `oklch(65% 0.06 ${h} / 0.12)`,
    text:   `oklch(75% 0.18 ${h})`,
  }
}

export default async function HomePage() {
  const [families, featured] = await Promise.all([
    getSoundFamilies(),
    getFeaturedSpecimens(),
  ])

  return (
    <main className="max-w-5xl mx-auto px-6 py-16 space-y-16">
      {/* Hero */}
      <section className="text-center space-y-4">
        <h1 className="text-6xl font-black tracking-tight" style={{ color: 'var(--genus-gold)' }}>
          GENUS
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Every sound has a lineage. Classify the specimen. Trace the strain.
        </p>
        <form action="/search" method="get" className="mt-6">
          <div className="flex gap-2 max-w-md mx-auto">
            <input
              name="q"
              type="text"
              placeholder="Search specimens…"
              className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--genus-gold)]"
            />
            <button
              type="submit"
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-black"
              style={{ background: 'var(--genus-gold)' }}
            >
              Search
            </button>
          </div>
        </form>
      </section>

      {/* Sound Families */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
          Sound Families
        </h2>
        {families.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No Sound Families seeded yet. Run{' '}
            <code className="font-mono bg-muted px-1 rounded">npx tsx scripts/seed-genus.ts</code>.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {families.map(fam => {
              const c = familyColor(fam.slug)
              return (
                <Link
                  key={fam.slug}
                  href={`/lineage/${fam.slug}`}
                  className="rounded-xl p-5 border transition-all hover:scale-[1.02] space-y-2"
                  style={{ borderColor: c.border, background: c.bg }}
                >
                  <div className="text-lg font-bold" style={{ color: c.text }}>
                    {fam.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fam.specimenCount} specimens
                  </div>
                  {fam.description && (
                    <div className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">
                      {fam.description}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Featured Specimens */}
      {featured.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Featured Specimens
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {featured.map(spec => {
              const c = familyColor(spec.primaryFamilySlug ?? '')
              return (
                <Link
                  key={spec.mbid}
                  href={`/specimen/${spec.mbid}`}
                  className="rounded-lg p-3 border flex flex-col gap-1.5 hover:bg-accent transition-colors"
                  style={{ borderColor: c.border }}
                >
                  <div className="text-xs font-semibold truncate" style={{ color: c.text }}>
                    {spec.primaryFamily}
                  </div>
                  <div className="text-sm font-medium truncate">{spec.name}</div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}
