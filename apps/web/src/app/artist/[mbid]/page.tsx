import { getArtistDetails } from '@/lib/data-service'
import * as mb from '@/lib/musicbrainz'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface ArtistPageProps {
  params: Promise<{ mbid: string }>
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { mbid } = await params
  const [artist, releaseGroups] = await Promise.all([
    getArtistDetails(mbid),
    mb.getArtistReleaseGroups(mbid, 25),
  ])

  const tags = artist.tags?.slice(0, 10) || []
  const spotifyGenres = artist.spotifyData?.genres || []

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to search
      </Link>

      <Card>
        <CardContent className="flex flex-col md:flex-row gap-6 p-6">
          {artist.spotifyData?.images?.[0] && (
            <img
              src={artist.spotifyData.images[0].url}
              alt={artist.name}
              className="w-40 h-40 rounded-full object-cover"
            />
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
                    ? ` - ${artist['life-span'].end}`
                    : ' - present'}
                </Badge>
              )}
            </div>
            <div className="flex gap-1 flex-wrap">
              {[...spotifyGenres, ...tags.map((t: any) => t.name)]
                .filter((v, i, a) => a.indexOf(v) === i)
                .slice(0, 12)
                .map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discography</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {releaseGroups['release-groups']?.map((rg: any) => (
              <Link
                key={rg.id}
                href={`/release-group/${rg.id}`}
                className="block"
              >
                <div className="flex justify-between items-center py-2 border-b last:border-0 hover:bg-accent px-2 rounded transition-colors">
                  <div>
                    <p className="font-medium">{rg.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {rg['first-release-date'] || 'Unknown date'}
                    </p>
                  </div>
                  <Badge variant="outline">{rg['primary-type'] || 'Release'}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
