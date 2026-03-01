import Link from 'next/link'
import { GeneratedAvatar } from '@/lib/avatar'

interface SearchResultsProps {
  results: {
    artists: any[]
    recordings: any[]
    spotifyTracks?: any[]
    spotifyArtists?: any[]
  }
}

// Find best Spotify track match: prefer title+artist, fall back to title-only
function findSpotifyTrack(recording: any, spotifyTracks: any[]) {
  const title = recording.title?.toLowerCase()
  if (!title) return null

  const dbArtists = (recording['artist-credit'] || [])
    .map((c: any) => (c.name || c.artist?.name)?.toLowerCase())
    .filter(Boolean)

  // Try exact title+artist match first
  for (const st of spotifyTracks) {
    if (st.name?.toLowerCase() !== title) continue
    const spArtists = (st.artists || []).map((a: any) => a.name?.toLowerCase())
    if (dbArtists.some((da: string) => spArtists.some((sa: string) => sa.includes(da) || da.includes(sa)))) {
      return st
    }
  }

  // No artist match found — don't return a wrong match
  return null
}

function ArtistCard({ artist, spotifyArtists }: { artist: any; spotifyArtists: any[] }) {
  const spArtist = spotifyArtists.find(
    (sa: any) => sa.name?.toLowerCase() === artist.name?.toLowerCase()
  )
  const imageUrl = spArtist?.images?.[1]?.url || spArtist?.images?.[0]?.url
  const tags = artist.tags || []

  return (
    <Link href={`/artist/${artist.id}`}>
      <div className="group relative aspect-square rounded-xl overflow-hidden bg-card card-hover">
        {imageUrl ? (
          <img src={imageUrl} alt={artist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full">
            <GeneratedAvatar id={artist.id} name={artist.name} genres={tags} size={200} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
          <p className="text-sm font-semibold text-white truncate">{artist.name}</p>
          {(artist.type || artist.country) && (
            <p className="text-[10px] text-white/60 truncate mt-0.5">
              {[artist.type, artist.country].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

function RecordingCard({ recording, spotifyTracks }: { recording: any; spotifyTracks: any[] }) {
  const spTrack = findSpotifyTrack(recording, spotifyTracks)
  const albumArt = spTrack?.album?.images?.[2]?.url || spTrack?.album?.images?.[1]?.url
  const artistNames = recording['artist-credit']
    ?.map((c: any) => c.name || c.artist?.name)
    .filter(Boolean)
    .join(', ')

  return (
    <Link href={`/recording/${recording.id}`}>
      <div className="flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-accent/10 transition-colors card-hover">
        <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden">
          {albumArt ? (
            <img src={albumArt} alt={recording.title} className="w-full h-full object-cover" />
          ) : (
            <GeneratedAvatar id={recording.id} name={recording.title} size={56} />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{recording.title}</p>
          {artistNames && (
            <p className="text-xs text-muted-foreground truncate">{artistNames}</p>
          )}
        </div>
      </div>
    </Link>
  )
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
    <div className="w-full max-w-3xl mx-auto space-y-8">
      {/* Artists — responsive grid with square cards */}
      {results.artists.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
            Artists
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {results.artists.map((artist: any) => (
              <ArtistCard key={artist.id} artist={artist} spotifyArtists={spotifyArtists} />
            ))}
          </div>
        </section>
      )}

      {/* Songs — 2-column card grid */}
      {results.recordings.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
            Songs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {results.recordings.map((recording: any) => (
              <RecordingCard key={recording.id} recording={recording} spotifyTracks={spotifyTracks} />
            ))}
          </div>
        </section>
      )}

      {/* Spotify fallback */}
      {spotifyTracks.length > 0 && results.recordings.length === 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
            Tracks from Spotify
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {spotifyTracks.map((track: any) => (
              <a key={track.id} href={track.external_urls?.spotify || '#'} target="_blank" rel="noopener noreferrer">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-accent/10 transition-colors card-hover">
                  <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-muted">
                    {track.album?.images?.[2]?.url ? (
                      <img src={track.album.images[2].url} alt={track.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-neutral-800" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{track.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {track.artists?.map((a: any) => a.name).join(', ')}
                    </p>
                  </div>
                  <span className="text-[10px] text-green-500/70 font-medium uppercase tracking-wider flex-shrink-0">Spotify</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {!hasAnyResults && (
        <p className="text-center text-muted-foreground/60 py-16 text-sm">
          No results found. Try a different search.
        </p>
      )}
    </div>
  )
}
