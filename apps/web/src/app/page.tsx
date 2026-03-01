import { Suspense } from 'react'
import { SearchBar } from '@/components/search-bar'
import { SearchResults } from '@/components/search-results'
import { searchAll, getDiscoveryData } from '@/lib/data-service'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface HomeProps {
  searchParams: Promise<{ q?: string }>
}

export default async function Home({ searchParams }: HomeProps) {
  const { q } = await searchParams

  // Fetch search results and discovery data in parallel
  const [results, discoveryData] = await Promise.all([
    q ? searchAll(q).catch(() => null) : Promise.resolve(null),
    getDiscoveryData(),
  ])

  const hasResults = !!results

  return (
    <main className="min-h-screen">
      {/* Hero section with search */}
      <section className="flex flex-col items-center px-4 sm:px-6 pt-12 sm:pt-20 pb-8 gap-6">
        <div className={`text-center space-y-3 transition-all duration-300 ${hasResults ? 'scale-90 opacity-80' : ''}`}>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-blue-400 bg-clip-text text-transparent">
            SoundGraph
          </h1>
          {!hasResults && (
            <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
              Discover music through connections. Explore the DNA of every song.
            </p>
          )}
        </div>
        <Suspense fallback={null}><SearchBar /></Suspense>
      </section>

      {/* Search results */}
      {hasResults ? (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-12">
          <SearchResults results={results} />
        </section>
      ) : (
        /* Discovery content when not searching */
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 space-y-12">
          {/* Most Sampled */}
          {discoveryData.mostSampled.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-amber-400">◆</span>
                Most Sampled Tracks
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                {discoveryData.mostSampled.map((rec) => (
                  <Link key={rec.mbid} href={`/recording/${rec.mbid}`}
                    className="group flex-shrink-0 w-36 space-y-2"
                  >
                    <div className="aspect-square rounded-xl bg-card border border-border group-hover:border-amber-400/30 transition-colors overflow-hidden flex items-center justify-center card-hover">
                      <div className="text-center p-3">
                        <div className="text-2xl font-bold text-amber-400/80">{rec.sample_count}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">samples</div>
                      </div>
                    </div>
                    <p className="text-xs font-medium line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {rec.title}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Top Producers */}
          {discoveryData.topProducers.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span className="text-blue-400">◆</span>
                Top Producers
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {discoveryData.topProducers.map((producer) => (
                  <Link key={producer.mbid} href={`/artist/${producer.mbid}`}
                    className="group flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-center card-hover"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center text-lg font-bold">
                      {producer.name.charAt(0)}
                    </div>
                    <p className="text-xs font-medium truncate w-full text-center group-hover:text-primary transition-colors">
                      {producer.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{producer.credit_count} credits</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
