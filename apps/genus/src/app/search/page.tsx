import Link from 'next/link'
import { searchSpecimens } from '@/lib/data-service'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''
  const results = query ? await searchSpecimens(query) : []

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to GENUS</Link>
        <h1 className="text-2xl font-bold mt-4">Search Specimens</h1>
      </div>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          type="text"
          defaultValue={query}
          autoFocus
          placeholder="Search by artist name…"
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--genus-gold)]"
        />
        <button
          type="submit"
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-black"
          style={{ background: 'var(--genus-gold)' }}
        >
          Search
        </button>
      </form>

      {query && (
        <div>
          <div className="text-xs text-muted-foreground mb-4">
            {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
          </div>
          {results.length === 0 ? (
            <p className="text-muted-foreground text-sm">No classified specimens found.</p>
          ) : (
            <div className="space-y-1">
              {results.map(spec => (
                <Link
                  key={spec.mbid}
                  href={`/specimen/${spec.mbid}`}
                  className="flex items-center justify-between rounded-lg px-4 py-3 border border-border hover:bg-accent transition-colors group"
                >
                  <div>
                    <div className="font-medium group-hover:text-primary transition-colors">{spec.name}</div>
                    {spec.lineage.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">{spec.lineage.join(' › ')}</div>
                    )}
                  </div>
                  {spec.primaryFamily && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full border shrink-0"
                      style={{ borderColor: 'var(--genus-gold-muted)', color: 'var(--genus-gold)' }}
                    >
                      {spec.primaryFamily}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
