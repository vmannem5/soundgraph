import { Badge } from '@/components/ui/badge'
import { GeneratedAvatar } from '@/lib/avatar'
import Link from 'next/link'

interface RecordingHeaderProps {
  recording: any
  connections: any[]
}

export function RecordingHeader({ recording, connections }: RecordingHeaderProps) {
  const duration = recording.length
    ? `${Math.floor(recording.length / 60000)}:${String(
      Math.floor((recording.length % 60000) / 1000)
    ).padStart(2, '0')}`
    : null

  const creditsCount = connections.filter((c) => c.targetType === 'artist').length
  const samples = connections.filter((c) => c.targetType === 'recording')
  const artistCredits: any[] = recording['artist-credit'] || []

  const albumArt =
    recording.spotifyData?.album?.images?.[1]?.url ||
    recording.spotifyData?.album?.images?.[0]?.url

  return (
    <div className="relative w-full overflow-hidden rounded-2xl">
      {/* Blurred background from album art */}
      <div
        className="absolute inset-0 opacity-40 blur-3xl scale-110"
        style={{
          backgroundImage: albumArt
            ? `url(${albumArt})`
            : 'linear-gradient(135deg, oklch(0.75 0.15 70), oklch(0.60 0.12 250))',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="relative flex items-end gap-6 p-6 sm:p-8">
        {/* Album art */}
        <div className="shrink-0">
          {albumArt ? (
            <img
              src={albumArt}
              alt=""
              className="w-36 h-36 sm:w-44 sm:h-44 rounded-xl shadow-2xl ring-1 ring-white/10 object-cover"
            />
          ) : (
            <GeneratedAvatar id={recording.id || recording.mbid} name={recording.title} size={176} />
          )}
        </div>
        {/* Title + artist + meta */}
        <div className="flex flex-col gap-2 pb-2 min-w-0">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight truncate">
            {recording.title}
          </h1>
          <div className="flex flex-wrap gap-2 text-lg text-muted-foreground">
            {artistCredits.map((c: any, i: number) => (
              <span key={i}>
                <Link
                  href={`/artist/${c.artist?.id}`}
                  className="hover:text-foreground transition-colors hover:underline"
                >
                  {c.name || c.artist?.name}
                </Link>
                {c.joinphrase || ''}
              </span>
            ))}
          </div>
          {/* Badges: duration, credits count, samples count */}
          <div className="flex gap-2 flex-wrap">
            {duration && <Badge variant="outline">{duration}</Badge>}
            {creditsCount > 0 && (
              <Badge variant="secondary">
                {creditsCount} credit{creditsCount !== 1 ? 's' : ''}
              </Badge>
            )}
            {samples.length > 0 && (
              <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                {samples.length} sample{samples.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
