import { getArtistDetails } from '@/lib/data-service'
import { prisma } from '@soundgraph/database'
import * as mb from '@/lib/musicbrainz'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface ArtistPageProps {
  params: Promise<{ mbid: string }>
}

async function getArtistReleaseGroupsFromDb(mbid: string) {
  // Get release groups via credits: artist → credits → recordings → release recordings → releases → release groups
  const results = await prisma.$queryRaw<Array<{
    mbid: string; title: string; type: string | null; firstReleaseDate: string | null
  }>>`
    SELECT DISTINCT rg.mbid, rg.title, rg.type, rg."firstReleaseDate"
    FROM "Artist" a
    JOIN "Credit" c ON c."artistId" = a.id
    JOIN "Recording" r ON r.id = c."recordingId"
    JOIN "ReleaseRecording" rr ON rr."recordingId" = r.id
    JOIN "Release" rel ON rel.id = rr."releaseId"
    JOIN "ReleaseGroup" rg ON rg.id = rel."releaseGroupId"
    WHERE a.mbid = ${mbid}
    ORDER BY rg."firstReleaseDate" DESC NULLS LAST
    LIMIT 30
  `.catch(() => [])

  return results.map(rg => ({
    id: rg.mbid,
    title: rg.title,
    'primary-type': rg.type,
    'first-release-date': rg.firstReleaseDate,
  }))
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { mbid } = await params

  let artist: any
  try {
    artist = await getArtistDetails(mbid)
  } catch {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to search
        </Link>
        <p className="text-muted-foreground">
          Artist not found.{' '}
          <Link href="/" className="underline hover:text-foreground">Back to search</Link>
        </p>
      </main>
    )
  }

  // Try API for release groups, fall back to DB
  let releaseGroupsList: any[] = []
  try {
    const rgs = await mb.getArtistReleaseGroups(mbid, 25)
    releaseGroupsList = rgs['release-groups'] || []
  } catch {
    releaseGroupsList = await getArtistReleaseGroupsFromDb(mbid)
  }

  const tags = artist.tags?.slice(0, 10) || []
  const spotifyGenres = artist.spotifyData?.genres || []

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        &larr; Back to search
      </Link>

      <Card className="overflow-hidden">
        <CardContent className="flex flex-col md:flex-row gap-6 p-6">
          {artist.spotifyData?.images?.[0] ? (
            <img
              src={artist.spotifyData.images[0].url}
              alt={artist.name}
              className="w-40 h-40 rounded-full object-cover ring-4 ring-border shadow-xl"
            />
          ) : (
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 flex items-center justify-center text-white text-5xl font-bold shadow-xl">
              {artist.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="flex-1 space-y-3">
            <h1 className="text-4xl font-bold">{artist.name}</h1>
            {artist.disambiguation && (
              <p className="text-muted-foreground">{artist.disambiguation}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {artist.type && <Badge>{artist.type}</Badge>}
              {artist.country && (
                <Badge variant="outline">{artist.country}</Badge>
              )}
              {artist['life-span']?.begin && (
                <Badge variant="secondary">
                  {artist['life-span'].begin}
                  {artist['life-span'].end
                    ? ` – ${artist['life-span'].end}`
                    : ' – present'}
                </Badge>
              )}
            </div>
            {(spotifyGenres.length > 0 || tags.length > 0) && (
              <div className="flex gap-1 flex-wrap pt-2">
                {[...spotifyGenres, ...tags.map((t: any) => t.name)]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .slice(0, 12)
                  .map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
              </div>
            )}
            {artist.spotifyData?.followers?.total && (
              <p className="text-sm text-muted-foreground pt-1">
                {artist.spotifyData.followers.total.toLocaleString()} Spotify followers
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discography</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {releaseGroupsList.map((rg: any) => (
              <Link
                key={rg.id}
                href={`/release-group/${rg.id}`}
                className="flex justify-between items-center py-3 px-3 rounded-lg hover:bg-accent/50 transition-all group"
              >
                <div>
                  <p className="font-medium group-hover:text-primary transition-colors">{rg.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {rg['first-release-date'] || 'Unknown date'}
                  </p>
                </div>
                <Badge variant="outline">{rg['primary-type'] || 'Release'}</Badge>
              </Link>
            ))}
            {releaseGroupsList.length === 0 && (
              <p className="text-muted-foreground text-sm py-4">No releases found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
