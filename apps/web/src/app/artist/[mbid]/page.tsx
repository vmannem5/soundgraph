import { getArtistDetails } from '@/lib/data-service'
import { prisma } from '@soundgraph/database'
import * as mb from '@/lib/musicbrainz'
import { Badge } from '@/components/ui/badge'
import { GeneratedAvatar } from '@/lib/avatar'
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

function sortReleaseGroupsNewestFirst(rgs: any[]): any[] {
  return [...rgs].sort((a, b) => {
    const dateA = a['first-release-date']
    const dateB = b['first-release-date']
    if (!dateA && !dateB) return 0
    if (!dateA) return 1
    if (!dateB) return -1
    return dateB.localeCompare(dateA)
  })
}

function ReleaseGroupCover({ rg, genres }: { rg: any; genres: string[] }) {
  const coverUrl = `https://coverartarchive.org/release-group/${rg.id}/front-250`
  const year = rg['first-release-date']?.slice(0, 4) || null

  return (
    <Link
      href={`/release-group/${rg.id}`}
      className="group flex flex-col gap-2"
    >
      <div className="relative w-full aspect-square overflow-hidden rounded-md bg-neutral-800 shadow-md group-hover:shadow-lg card-hover">
        <img
          src={coverUrl}
          alt={rg.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            // Hide the img and show the fallback avatar via sibling visibility
            const target = e.currentTarget as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.display = 'flex'
          }}
        />
        {/* Fallback avatar — hidden by default, shown via JS onError */}
        <div
          className="absolute inset-0 items-center justify-center"
          style={{ display: 'none' }}
          aria-hidden="true"
        >
          <GeneratedAvatar id={rg.id} name={rg.title} genres={genres} size={200} />
        </div>
      </div>
      <div className="space-y-0.5 px-0.5">
        <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {rg.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {[year, rg['primary-type']].filter(Boolean).join(' · ') || 'Unknown'}
        </p>
      </div>
    </Link>
  )
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

  // Sort newest first
  releaseGroupsList = sortReleaseGroupsNewestFirst(releaseGroupsList)

  const tags = artist.tags?.slice(0, 10) || []
  const spotifyGenres: string[] = artist.spotifyData?.genres || []
  const allGenres = [...spotifyGenres, ...tags.map((t: any) => t.name)]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 12)

  const heroImageUrl: string | null = artist.spotifyData?.images?.[0]?.url ?? null

  return (
    <main className="min-h-screen">
      {/* Editorial hero */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: '340px' }}>
        {/* Blurred background */}
        {heroImageUrl ? (
          <>
            <img
              src={heroImageUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'blur(40px)', transform: 'scale(1.15)', opacity: 0.45 }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-background" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-800/80 to-background" />
        )}

        {/* Back link */}
        <div className="relative z-10 px-4 sm:px-8 pt-6">
          <Link
            href="/"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            &larr; Back to search
          </Link>
        </div>

        {/* Hero content */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6 px-4 sm:px-8 pb-8 pt-4">
          {/* Artist photo */}
          <div
            className="shrink-0 rounded-full overflow-hidden ring-4 ring-white/20 shadow-2xl bg-neutral-800"
            style={{ width: 160, height: 160 }}
          >
            {heroImageUrl ? (
              <img
                src={heroImageUrl}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <GeneratedAvatar
                id={mbid}
                name={artist.name}
                genres={spotifyGenres}
                size={160}
              />
            )}
          </div>

          {/* Text block */}
          <div className="flex flex-col gap-3 text-center sm:text-left">
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              {artist.type && (
                <Badge className="bg-white/15 text-white border-white/20 text-xs backdrop-blur">
                  {artist.type}
                </Badge>
              )}
              {artist.country && (
                <Badge variant="outline" className="border-white/30 text-white/80 text-xs backdrop-blur">
                  {artist.country}
                </Badge>
              )}
              {artist['life-span']?.begin && (
                <Badge variant="outline" className="border-white/30 text-white/80 text-xs backdrop-blur">
                  {artist['life-span'].begin}
                  {artist['life-span'].end
                    ? ` – ${artist['life-span'].end}`
                    : ' – present'}
                </Badge>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold text-white drop-shadow-lg leading-tight">
              {artist.name}
            </h1>

            {artist.disambiguation && (
              <p className="text-white/60 text-sm">{artist.disambiguation}</p>
            )}

            {/* Genre pills */}
            {allGenres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
                {allGenres.map((tag: string) => (
                  <span
                    key={tag}
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/80 border border-white/15 backdrop-blur"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {artist.spotifyData?.followers?.total && (
              <p className="text-sm text-white/50">
                {artist.spotifyData.followers.total.toLocaleString()} Spotify followers
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Discography grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-4">
        <h2 className="text-xl font-semibold">Discography</h2>
        {releaseGroupsList.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {releaseGroupsList.map((rg: any) => (
              <ReleaseGroupCover key={rg.id} rg={rg} genres={spotifyGenres} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm py-4">No releases found.</p>
        )}
      </div>
    </main>
  )
}
