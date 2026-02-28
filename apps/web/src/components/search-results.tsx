import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface SearchResultsProps {
  results: {
    artists: any[]
    recordings: any[]
    spotifyTracks?: any[]
    spotifyArtists?: any[]
  }
}

export function SearchResults({ results }: SearchResultsProps) {
  const spotifyTracks = results.spotifyTracks || []
  const spotifyArtists = results.spotifyArtists || []

  const hasAnyResults =
    results.artists.length > 0 ||
    results.recordings.length > 0 ||
    spotifyTracks.length > 0 ||
    spotifyArtists.length > 0

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* MusicBrainz Artists */}
      {results.artists.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            Artists
          </h2>
          <div className="grid gap-3">
            {results.artists.map((artist: any) => {
              // Find matching Spotify artist for image
              const spArtist = spotifyArtists.find(
                (sa: any) => sa.name?.toLowerCase() === artist.name?.toLowerCase()
              )
              const imageUrl = spArtist?.images?.[2]?.url || spArtist?.images?.[1]?.url || spArtist?.images?.[0]?.url

              return (
                <Link key={artist.id} href={`/artist/${artist.id}`}>
                  <Card className="hover:bg-accent/50 transition-all duration-200 cursor-pointer hover:shadow-md group">
                    <CardContent className="flex items-center gap-4 p-4">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={artist.name}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-border group-hover:ring-primary/50 transition-all"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-lg font-bold">
                          {artist.name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{artist.name}</p>
                        {artist.disambiguation && (
                          <p className="text-sm text-muted-foreground truncate">
                            {artist.disambiguation}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {artist.type && <Badge variant="outline">{artist.type}</Badge>}
                        {artist.country && (
                          <Badge variant="secondary">{artist.country}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* MusicBrainz Recordings */}
      {results.recordings.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
            Songs
          </h2>
          <div className="grid gap-3">
            {results.recordings.map((recording: any) => {
              // Find matching Spotify track for album art
              const spTrack = spotifyTracks.find(
                (st: any) => st.name?.toLowerCase() === recording.title?.toLowerCase()
              )
              const albumArt = spTrack?.album?.images?.[2]?.url || spTrack?.album?.images?.[1]?.url

              return (
                <Link key={recording.id} href={`/recording/${recording.id}`}>
                  <Card className="hover:bg-accent/50 transition-all duration-200 cursor-pointer hover:shadow-md group">
                    <CardContent className="flex items-center gap-4 p-4">
                      {albumArt ? (
                        <img
                          src={albumArt}
                          alt={recording.title}
                          className="w-12 h-12 rounded-lg object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                          <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{recording.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {recording['artist-credit']
                            ?.map((c: any) => c.name || c.artist?.name)
                            .join(', ')}
                        </p>
                      </div>
                      {recording.length && (
                        <span className="text-sm text-muted-foreground tabular-nums flex-shrink-0">
                          {Math.floor(recording.length / 60000)}:
                          {String(
                            Math.floor((recording.length % 60000) / 1000)
                          ).padStart(2, '0')}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Spotify-only Tracks (if MB results are sparse) */}
      {spotifyTracks.length > 0 && results.recordings.length === 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            Tracks from Spotify
          </h2>
          <div className="grid gap-3">
            {spotifyTracks.map((track: any) => (
              <Card key={track.id} className="hover:bg-accent/50 transition-all duration-200 hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  {track.album?.images?.[2]?.url ? (
                    <img
                      src={track.album.images[2].url}
                      alt={track.album.name}
                      className="w-12 h-12 rounded-lg object-cover ring-1 ring-border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{track.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {track.artists?.map((a: any) => a.name).join(', ')}
                    </p>
                  </div>
                  {track.external_urls?.spotify && (
                    <a
                      href={track.external_urls.spotify}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-500 hover:text-green-400 transition-colors"
                    >
                      Open in Spotify
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {!hasAnyResults && (
        <p className="text-center text-muted-foreground py-12">
          No results found. Try a different search.
        </p>
      )}
    </div>
  )
}
