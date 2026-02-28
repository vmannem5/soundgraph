/* eslint-disable @typescript-eslint/no-explicit-any */
import * as mb from '@/lib/musicbrainz'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface ReleaseGroupPageProps {
    params: Promise<{ id: string }>
}

export default async function ReleaseGroupPage({ params }: ReleaseGroupPageProps) {
    const { id } = await params

    let releaseGroup: any
    try {
        releaseGroup = await mb.getReleaseGroup(id)
    } catch {
        // Retry once after a delay (MusicBrainz rate limit is 1 req/sec)
        try {
            await new Promise(r => setTimeout(r, 1500))
            releaseGroup = await mb.getReleaseGroup(id)
        } catch {
            return (
                <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
                    <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
                        &larr; Back to search
                    </Link>
                    <p className="text-muted-foreground">
                        Failed to load release group — MusicBrainz may be rate-limiting requests.{' '}
                        <a href={`/release-group/${id}`} className="underline hover:text-foreground">Try again</a>
                    </p>
                </main>
            )
        }
    }

    const artistName = releaseGroup['artist-credit']
        ?.map((c: any) => c.name || c.artist?.name)
        .join(', ') || 'Unknown Artist'

    const releases = releaseGroup.releases || []
    const tags = releaseGroup.tags?.slice(0, 10) || []

    return (
        <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
            <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                &larr; Back to search
            </Link>

            <Card>
                <CardContent className="p-6 space-y-3">
                    <div className="space-y-1">
                        <Badge variant="outline" className="text-xs">
                            {releaseGroup['primary-type'] || 'Release'}
                        </Badge>
                        <h1 className="text-4xl font-bold">{releaseGroup.title}</h1>
                        <p className="text-lg text-muted-foreground">{artistName}</p>
                    </div>
                    {releaseGroup['first-release-date'] && (
                        <p className="text-sm text-muted-foreground">
                            First released: {releaseGroup['first-release-date']}
                        </p>
                    )}
                    {tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap pt-2">
                            {tags.map((tag: any) => (
                                <Badge key={tag.name} variant="outline" className="text-xs">
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {releases.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Releases ({releases.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {releases.map((release: any) => (
                                <div
                                    key={release.id}
                                    className="flex justify-between items-center py-2 border-b last:border-0 px-2 rounded"
                                >
                                    <div>
                                        <p className="font-medium">{release.title}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {release.date || 'Unknown date'}
                                            {release.country ? ` · ${release.country}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        {release.status && (
                                            <Badge variant="outline" className="text-xs">{release.status}</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </main>
    )
}
