import Link from 'next/link'

interface SearchResultsProps {
  results: {
    artists: any[]
    recordings: any[]
    spotifyTracks?: any[]
    spotifyArtists?: any[]
  }
}

function formatDuration(ms: number) {
  const min = Math.floor(ms / 60000)
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  return `${min}:${sec}`
}

// Deterministic color from name for avatar fallbacks
const AVATAR_GRADIENTS = [
  'from-rose-600 to-pink-800',
  'from-violet-600 to-purple-800',
  'from-blue-600 to-indigo-800',
  'from-cyan-600 to-teal-800',
  'from-emerald-600 to-green-800',
  'from-amber-600 to-orange-800',
  'from-red-600 to-rose-800',
  'from-fuchsia-600 to-pink-800',
  'from-sky-600 to-blue-800',
  'from-lime-600 to-emerald-800',
]

function getGradient(name: string) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
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

function ArtistTile({ artist, spotifyArtists }: { artist: any; spotifyArtists: any[] }) {
  const spArtist = spotifyArtists.find(
    (sa: any) => sa.name?.toLowerCase() === artist.name?.toLowerCase()
  )
  const imageUrl = spArtist?.images?.[1]?.url || spArtist?.images?.[0]?.url
  const gradient = getGradient(artist.name)

  return (
    <Link
      href={`/artist/${artist.id}`}
      className="group flex flex-col items-center gap-2 rounded-xl hover:bg-white/5 transition-colors"
      style={{ width: 100, padding: '10px 6px', flexShrink: 0 }}
    >
      <div
        className="rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-white/25 transition-all shadow-lg"
        style={{ width: 72, height: 72, minWidth: 72, minHeight: 72 }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={artist.name} style={{ width: 72, height: 72, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div className={`flex items-center justify-center bg-gradient-to-br ${gradient}`} style={{ width: 72, height: 72 }}>
            <span className="text-xl font-bold text-white/90">
              {artist.name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        )}
      </div>
      <div className="text-center w-full" style={{ minWidth: 0 }}>
        <p className="text-xs font-medium truncate">{artist.name}</p>
        {(artist.type || artist.country) && (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {[artist.type, artist.country].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </Link>
  )
}

function RecordingRow({ recording, spotifyTracks, index }: { recording: any; spotifyTracks: any[]; index: number }) {
  const spTrack = findSpotifyTrack(recording, spotifyTracks)
  const albumArt = spTrack?.album?.images?.[2]?.url || spTrack?.album?.images?.[1]?.url
  const artistNames = recording['artist-credit']
    ?.map((c: any) => c.name || c.artist?.name)
    .filter(Boolean)
    .join(', ')
  const gradient = getGradient(recording.title + (artistNames || ''))

  return (
    <Link href={`/recording/${recording.id}`} className="group">
      <div className={`flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors ${index % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
        <span className="text-xs text-muted-foreground/50 w-5 text-right tabular-nums flex-shrink-0">{index + 1}</span>
        <div className="w-11 h-11 rounded-md overflow-hidden flex-shrink-0 shadow-md">
          {albumArt ? (
            <img src={albumArt} alt={recording.title} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${gradient}`}>
              <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-white transition-colors">{recording.title}</p>
          {artistNames && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{artistNames}</p>
          )}
        </div>
        {recording.length && (
          <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
            {formatDuration(recording.length)}
          </span>
        )}
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
      {/* Artists — horizontal scroll, uniform circles */}
      {results.artists.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Artists
          </h2>
          <div className="flex gap-1 overflow-x-auto pb-2 -mx-2 px-2" style={{ scrollbarWidth: 'none' }}>
            {results.artists.map((artist: any) => (
              <ArtistTile key={artist.id} artist={artist} spotifyArtists={spotifyArtists} />
            ))}
          </div>
        </section>
      )}

      {/* Songs — rows with album art */}
      {results.recordings.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Songs
          </h2>
          <div className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.02]">
            {results.recordings.map((recording: any, i: number) => (
              <RecordingRow key={recording.id} recording={recording} spotifyTracks={spotifyTracks} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Spotify fallback */}
      {spotifyTracks.length > 0 && results.recordings.length === 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">
            Tracks from Spotify
          </h2>
          <div className="rounded-xl border border-white/5 overflow-hidden bg-white/[0.02]">
            {spotifyTracks.map((track: any, i: number) => (
              <a key={track.id} href={track.external_urls?.spotify || '#'} target="_blank" rel="noopener noreferrer"
                className={`flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors group ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                <span className="text-xs text-muted-foreground/50 w-5 text-right tabular-nums flex-shrink-0">{i + 1}</span>
                <div className="w-11 h-11 rounded-md overflow-hidden flex-shrink-0 shadow-md bg-muted">
                  {track.album?.images?.[2]?.url ? (
                    <img src={track.album.images[2].url} alt={track.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-neutral-800" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{track.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {track.artists?.map((a: any) => a.name).join(', ')}
                  </p>
                </div>
                <span className="text-[10px] text-green-500/70 font-medium uppercase tracking-wider flex-shrink-0">Spotify</span>
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
