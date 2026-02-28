import { Suspense } from 'react'
import { SearchBar } from '@/components/search-bar'
import { SearchResults } from '@/components/search-results'
import { searchAll } from '@/lib/data-service'

interface HomeProps {
  searchParams: Promise<{ q?: string }>
}

export default async function Home({ searchParams }: HomeProps) {
  const { q } = await searchParams
  const results = q ? await searchAll(q) : null

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

      {results && <SearchResults results={results} />}
    </main>
  )
}
