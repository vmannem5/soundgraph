import { getRecordingConnections } from '@/lib/data-service'
import { KnowledgeGraph } from '@/components/knowledge-graph'
import { RecordingHeader } from '@/components/recording-header'
import { SpotifyEmbed } from '@/components/spotify-embed'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface RecordingPageProps {
  params: Promise<{ mbid: string }>
}

export default async function RecordingPage({ params }: RecordingPageProps) {
  const { mbid } = await params

  let recording: any
  let connections: any[]
  try {
    const data = await getRecordingConnections(mbid)
    recording = data.recording
    connections = data.connections
  } catch {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-4">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to search
        </Link>
        <p className="text-muted-foreground">Failed to load recording. Please try again.</p>
      </main>
    )
  }

  const credits = connections.filter(
    (c) => c.targetType === 'artist' && c.type !== 'performer'
  )
  const performers = connections.filter(
    (c) => c.targetType === 'artist' && c.type === 'performer'
  )
  const samples = connections.filter(
    (c) => c.targetType === 'recording'
  )

  // Extract Spotify track ID if available
  const spotifyTrackId = recording.spotifyData?.id ||
    recording.spotifyData?.external_urls?.spotify?.match(/track\/([a-zA-Z0-9]+)/)?.[1]

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to search
      </Link>

      <RecordingHeader recording={recording} connections={connections} />

      {/* Spotify Embedded Player */}
      {spotifyTrackId && (
        <SpotifyEmbed trackId={spotifyTrackId} />
      )}

      <Tabs defaultValue="graph" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="graph">Mind Map</TabsTrigger>
          <TabsTrigger value="credits">Credits ({credits.length})</TabsTrigger>
          <TabsTrigger value="performers">
            Performers ({performers.length})
          </TabsTrigger>
          {samples.length > 0 && (
            <TabsTrigger value="samples">
              Samples ({samples.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="graph" className="mt-4">
          <KnowledgeGraph recording={recording} connections={connections} />
        </TabsContent>

        <TabsContent value="credits" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Credits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {credits.map((credit) => (
                  <div
                    key={`${credit.targetId}-${credit.type}`}
                    className="flex justify-between items-center py-2 border-b last:border-0"
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
                {credits.length === 0 && (
                  <p className="text-muted-foreground text-sm">No credits found.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Performers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {performers.map((perf) => (
                  <div
                    key={`${perf.targetId}-${perf.type}`}
                    className="flex justify-between items-center py-2 border-b last:border-0"
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
                {performers.length === 0 && (
                  <p className="text-muted-foreground text-sm">No performers found.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {samples.length > 0 && (
          <TabsContent value="samples" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Samples</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {samples.map((sample) => (
                    <div
                      key={sample.targetId}
                      className="flex justify-between items-center py-2 border-b last:border-0"
                    >
                      <Link
                        href={`/recording/${sample.targetId}`}
                        className="font-medium hover:underline"
                      >
                        {sample.targetName}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        {sample.type}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </main>
  )
}
