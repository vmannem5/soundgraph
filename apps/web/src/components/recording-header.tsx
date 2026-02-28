import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface RecordingHeaderProps {
  recording: any
  connections: any[]
}

export function RecordingHeader({ recording, connections }: RecordingHeaderProps) {
  const artistNames = recording['artist-credit']
    ?.map((c: any) => c.name || c.artist?.name)
    .join(', ')

  const duration = recording.length
    ? `${Math.floor(recording.length / 60000)}:${String(
        Math.floor((recording.length % 60000) / 1000)
      ).padStart(2, '0')}`
    : null

  const producers = connections.filter((c) => c.type === 'producer')
  const tags = recording.tags?.slice(0, 8) || []

  return (
    <Card>
      <CardContent className="flex flex-col md:flex-row gap-6 p-6">
        {recording.spotifyData?.album?.images?.[0] && (
          <img
            src={recording.spotifyData.album.images[0].url}
            alt={recording.title}
            className="w-32 h-32 rounded-lg object-cover"
          />
        )}
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-bold">{recording.title}</h1>
          <p className="text-lg text-muted-foreground">{artistNames}</p>
          <div className="flex gap-2 flex-wrap">
            {duration && <Badge variant="outline">{duration}</Badge>}
            {producers.map((p) => (
              <Badge key={p.targetId} variant="secondary">
                Produced by {p.targetName}
              </Badge>
            ))}
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
