import { Suspense } from 'react'
import { SearchBar } from '@/components/search-bar'
import { SearchResults } from '@/components/search-results'
import { searchAll } from '@/lib/data-service'

export const dynamic = 'force-dynamic'

interface HomeProps {
  searchParams: Promise<{ q?: string }>
}

export default async function Home({ searchParams }: HomeProps) {
  const { q } = await searchParams
  let results = null
  let searchError = false

  if (q) {
    try {
      results = await searchAll(q)
    } catch {
      searchError = true
    }
  }

  const hasResults = !!results

  return (
    <main className="min-h-screen flex flex-col items-center px-4 sm:px-6 pt-12 sm:pt-20 pb-12 gap-6">
      <div className={`text-center space-y-3 transition-all duration-300 ${hasResults ? 'scale-90 opacity-80' : ''}`}>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 bg-clip-text text-transparent">
          SoundGraph
        </h1>
        {!hasResults && (
          <p className="text-base sm:text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
            Discover music through connections. Explore the DNA of every song.
          </p>
        )}
      </div>

      <Suspense fallback={null}>
        <SearchBar />
      </Suspense>

      {searchError && (
        <p className="text-center text-muted-foreground py-12">
          Search is temporarily unavailable. Please try again.
        </p>
      )}
      {results && <SearchResults results={results} />}
    </main>
  )
}
