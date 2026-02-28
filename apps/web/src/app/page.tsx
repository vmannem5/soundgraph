import { Suspense } from 'react'
import { SearchBar } from '@/components/search-bar'
import { SearchResults } from '@/components/search-results'
import { searchAll } from '@/lib/data-service'

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

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-16 gap-8">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-bold tracking-tight">SoundGraph</h1>
        <p className="text-lg text-muted-foreground max-w-md">
          Discover music through connections. Explore the DNA of every song.
        </p>
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
