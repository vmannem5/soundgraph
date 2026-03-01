/* eslint-disable @typescript-eslint/no-explicit-any */
import * as mb from '@/lib/musicbrainz'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface ReleaseGroupPageProps {
    params: Promise<{ id: string }>
}

function formatDuration(ms: number) {
    const min = Math.floor(ms / 60000)
    const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
    return `${min}:${sec}`
}

export default async function ReleaseGroupPage({ params }: ReleaseGroupPageProps) {
    const { id } = await params

    let releaseGroup: any
    try {
        releaseGroup = await mb.getReleaseGroup(id)
    } catch {
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
                        Failed to load release group.{' '}
                        <a href={`/release-group/${id}`} className="underline hover:text-foreground">Try again</a>
                    </p>
                </main>
            )
        }
    }

    const artistName = releaseGroup['artist-credit']
        ?.map((c: any) => c.name || c.artist?.name)
        .join(', ') || 'Unknown Artist'

    const tags = releaseGroup.tags?.slice(0, 10) || []

    // Fetch tracklist from the first official release (or any release)
    const releases: any[] = releaseGroup.releases || []
    const primaryRelease = releases.find((r: any) => r.status === 'Official') || releases[0]

    let tracklist: any[] = []
    if (primaryRelease?.id) {
        try {
            const releaseData = await mb.getRelease(primaryRelease.id)
            // Flatten all tracks from all media
            tracklist = (releaseData.media || []).flatMap((medium: any) =>
                (medium.tracks || []).map((track: any) => ({
                    ...track,
                    position: track.position,
                    discNumber: medium.position,
                    totalDiscs: releaseData.media?.length || 1,
                }))
            )
        } catch {
            // Tracklist unavailable — show nothing
        }
    }

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

            {tracklist.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Tracklist ({tracklist.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div>
                            {tracklist.map((track: any, i: number) => {
                                const recording = track.recording || {}
                                const mbid = recording.id
                                const title = track.title || recording.title || 'Unknown'
                                const length = track.length || recording.length
                                return (
                                    <div
                                        key={track.id || i}
                                        className={`flex items-center gap-4 px-4 py-3 ${i % 2 === 1 ? 'bg-white/[0.02]' : ''}`}
                                    >
                                        <span className="text-sm text-muted-foreground w-6 text-right shrink-0">
                                            {track.position}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            {mbid ? (
                                                <Link
                                                    href={`/recording/${mbid}`}
                                                    className="font-medium hover:text-primary transition-colors truncate block"
                                                >
                                                    {title}
                                                </Link>
                                            ) : (
                                                <span className="font-medium truncate block">{title}</span>
                                            )}
                                        </div>
                                        {length && (
                                            <span className="text-sm text-muted-foreground shrink-0">
                                                {formatDuration(length)}
                                            </span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {tracklist.length === 0 && releases.length > 0 && (
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
                                    {release.status && (
                                        <Badge variant="outline" className="text-xs">{release.status}</Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </main>
    )
}
