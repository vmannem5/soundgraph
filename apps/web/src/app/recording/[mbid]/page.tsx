import { getRecordingConnections } from '@/lib/data-service'
import { KnowledgeGraph } from '@/components/knowledge-graph'
import { RecordingHeader } from '@/components/recording-header'
import { SpotifyEmbed } from '@/components/spotify-embed'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface RecordingPageProps {
  params: Promise<{ mbid: string }>
}

export default async function RecordingPage({ params }: RecordingPageProps) {
  const { mbid } = await params

  const data = await getRecordingConnections(mbid)
  const recording = data.recording
  const connections = data.connections

  const credits = connections.filter(
    (c) => c.targetType === 'artist' && c.type !== 'performer'
  )
  const performers = connections.filter(
    (c) => c.targetType === 'artist' && c.type === 'performer'
  )
  const samples = connections.filter(
    (c) => c.targetType === 'recording'
  )

  const spotifyTrackId = recording.spotifyData?.id ||
    recording.spotifyData?.external_urls?.spotify?.match(/track\/([a-zA-Z0-9]+)/)?.[1]

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to search
      </Link>

      <RecordingHeader recording={recording} connections={connections} />

      {spotifyTrackId && (
        <SpotifyEmbed trackId={spotifyTrackId} />
      )}

      {/* Mind Map — always visible, fixed height so page scrolls past it */}
      <section>
        <h2 className="text-xl font-bold mb-3">Mind Map</h2>
        <KnowledgeGraph recording={recording} connections={connections} />
      </section>

      {/* Credits */}
      {credits.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-3">Credits ({credits.length})</h2>
          <Card>
            <CardContent className="pt-4">
              <div className="divide-y">
                {credits.map((credit) => (
                  <div
                    key={`${credit.targetId}-${credit.type}`}
                    className="flex justify-between items-center py-3"
                  >
                    <Link
                      href={`/artist/${credit.targetId}`}
                      className="font-medium hover:underline"
                    >
                      {credit.targetName}
                    </Link>
                    <span className="text-sm text-muted-foreground capitalize">
                      {credit.type}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Performers */}
      {performers.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-3">Performers ({performers.length})</h2>
          <Card>
            <CardContent className="pt-4">
              <div className="divide-y">
                {performers.map((perf) => (
                  <div
                    key={`${perf.targetId}-${perf.type}`}
                    className="flex justify-between items-center py-3"
                  >
                    <Link
                      href={`/artist/${perf.targetId}`}
                      className="font-medium hover:underline"
                    >
                      {perf.targetName}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {perf.attributes?.join(', ') || 'performer'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Samples */}
      {samples.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-3">Samples ({samples.length})</h2>
          <Card>
            <CardContent className="pt-4">
              <div className="divide-y">
                {samples.map((sample) => (
                  <div
                    key={sample.targetId}
                    className="flex justify-between items-center py-3"
                  >
                    <Link
                      href={`/recording/${sample.targetId}`}
                      className="font-medium hover:underline"
                    >
                      {sample.targetName}
                    </Link>
                    <span className="text-sm text-muted-foreground capitalize">
                      {sample.type}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  )
}
