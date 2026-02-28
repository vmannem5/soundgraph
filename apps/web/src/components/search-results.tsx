import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface SearchResultsProps {
  results: {
    artists: any[]
    recordings: any[]
  }
}

export function SearchResults({ results }: SearchResultsProps) {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      {results.artists.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Artists</h2>
          <div className="grid gap-3">
            {results.artists.map((artist: any) => (
              <Link key={artist.id} href={`/artist/${artist.id}`}>
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1">
                      <p className="font-medium">{artist.name}</p>
                      {artist.disambiguation && (
                        <p className="text-sm text-muted-foreground">
                          {artist.disambiguation}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {artist.type && <Badge variant="outline">{artist.type}</Badge>}
                      {artist.country && (
                        <Badge variant="secondary">{artist.country}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.recordings.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Songs</h2>
          <div className="grid gap-3">
            {results.recordings.map((recording: any) => (
              <Link key={recording.id} href={`/recording/${recording.id}`}>
                <Card className="hover:bg-accent transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex-1">
                      <p className="font-medium">{recording.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {recording['artist-credit']
                          ?.map((c: any) => c.name || c.artist?.name)
                          .join(', ')}
                      </p>
                    </div>
                    {recording.length && (
                      <span className="text-sm text-muted-foreground">
                        {Math.floor(recording.length / 60000)}:
                        {String(
                          Math.floor((recording.length % 60000) / 1000)
                        ).padStart(2, '0')}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.artists.length === 0 && results.recordings.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          No results found. Try a different search.
        </p>
      )}
    </div>
  )
}
