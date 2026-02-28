import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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

  const producers = connections.filter((c) => c.type === 'producer')
  const samples = connections.filter((c) => c.targetType === 'recording')
  const tags = recording.tags?.slice(0, 8) || []

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col md:flex-row gap-5 p-5">
        {recording.spotifyData?.album?.images?.[0] ? (
          <img
            src={recording.spotifyData.album.images[0].url}
            alt={recording.title}
            className="w-36 h-36 rounded-xl object-cover shadow-xl ring-2 ring-border"
          />
        ) : (
          <div className="w-36 h-36 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl">
            <svg className="w-12 h-12 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-bold">{recording.title}</h1>
          <p className="text-lg text-muted-foreground">
            {recording['artist-credit']?.map((c: any, i: number) => (
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
          </p>
          <div className="flex gap-2 flex-wrap">
            {duration && <Badge variant="outline">{duration}</Badge>}
            {producers.map((p) => (
              <Badge key={p.targetId} variant="secondary">
                Produced by {p.targetName}
              </Badge>
            ))}
            {samples.length > 0 && (
              <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                {samples.length} sample{samples.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex gap-1 flex-wrap pt-2">
              {tags.map((tag: any) => (
                <Badge key={tag.name} variant="outline" className="text-xs">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
