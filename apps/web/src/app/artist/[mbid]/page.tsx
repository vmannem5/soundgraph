import { getArtistDetails, getArtistConnections } from '@/lib/data-service'
import { prisma } from '@soundgraph/database'
import * as mb from '@/lib/musicbrainz'
import { Badge } from '@/components/ui/badge'
import { GeneratedAvatar } from '@/lib/avatar'
import { ReleaseGroupCover } from '@/components/release-group-cover'
import { KnowledgeGraph } from '@/components/knowledge-graph'
import { BackButton } from '@/components/back-button'
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

  // Fetch connections (collaborators, producers, samples) in parallel with release groups
  const [connectionsData, releaseGroupsResult] = await Promise.all([
    getArtistConnections(mbid),
    (async () => {
      try {
        const rgs = await mb.getArtistReleaseGroups(mbid, 25)
        return rgs['release-groups'] || []
      } catch {
        return await getArtistReleaseGroupsFromDb(mbid)
      }
    })(),
  ])
  const { topCollaborators, topProducers, samplesFrom, sampledBy } = connectionsData

  // Sort newest first
  const releaseGroupsList = sortReleaseGroupsNewestFirst(releaseGroupsResult)

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
          <BackButton className="text-white/70 hover:text-white" />
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

      {/* Connections section */}
      {(topCollaborators.length > 0 || topProducers.length > 0 || samplesFrom.length > 0 || sampledBy.length > 0) && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pb-8 space-y-10">

          {/* Top Collaborators */}
          {topCollaborators.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Top Collaborators</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {topCollaborators.map((a) => (
                  <Link
                    key={a.mbid}
                    href={`/artist/${a.mbid}`}
                    className="group flex flex-col items-center gap-2 shrink-0 w-24"
                  >
                    <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-primary transition-all">
                      <GeneratedAvatar id={a.mbid} name={a.name} genres={[]} size={64} />
                    </div>
                    <p className="text-xs text-center font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {a.name}
                    </p>
                    <span className="text-xs text-muted-foreground">{a.count} tracks</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Top Producers */}
          {topProducers.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Produced By</h2>
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {topProducers.map((a) => (
                  <Link
                    key={a.mbid}
                    href={`/artist/${a.mbid}`}
                    className="group flex flex-col items-center gap-2 shrink-0 w-24"
                  >
                    <div className="w-16 h-16 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-primary transition-all">
                      <GeneratedAvatar id={a.mbid} name={a.name} genres={[]} size={64} />
                    </div>
                    <p className="text-xs text-center font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {a.name}
                    </p>
                    <span className="text-xs text-muted-foreground">{a.count} tracks</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Sample History */}
          {(samplesFrom.length > 0 || sampledBy.length > 0) && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Sample History</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                {samplesFrom.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Sampled From ({samplesFrom.length})
                    </h3>
                    <div className="space-y-1">
                      {samplesFrom.map((s) => (
                        <Link
                          key={s.rec_mbid}
                          href={`/recording/${s.rec_mbid}`}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded shrink-0 overflow-hidden">
                            <GeneratedAvatar id={s.rec_mbid} name={s.rec_title} genres={[]} size={32} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {s.rec_title}
                            </p>
                            {s.artist_name && (
                              <p className="text-xs text-muted-foreground truncate">{s.artist_name}</p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {sampledBy.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Sampled By ({sampledBy.length})
                    </h3>
                    <div className="space-y-1">
                      {sampledBy.map((s) => (
                        <Link
                          key={s.rec_mbid}
                          href={`/recording/${s.rec_mbid}`}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded shrink-0 overflow-hidden">
                            <GeneratedAvatar id={s.rec_mbid} name={s.rec_title} genres={[]} size={32} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                              {s.rec_title}
                            </p>
                            {s.artist_name && (
                              <p className="text-xs text-muted-foreground truncate">{s.artist_name}</p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Connection Mind Map */}
          {(topCollaborators.length > 0 || topProducers.length > 0 || samplesFrom.length > 0 || sampledBy.length > 0) && (
            <section>
              <h2 className="text-xl font-semibold mb-4">Connection Map</h2>
              <KnowledgeGraph
                recording={{
                  id: mbid,
                  title: artist.name,
                  spotifyData: heroImageUrl
                    ? { album: { images: [{ url: heroImageUrl }] } }
                    : undefined,
                }}
                connections={[
                  ...topCollaborators.slice(0, 8).map((a) => ({
                    type: 'performer',
                    label: `${a.count} collabs`,
                    targetType: 'artist',
                    targetId: a.mbid,
                    targetName: a.name,
                  })),
                  ...topProducers.slice(0, 6).map((a) => ({
                    type: 'producer',
                    label: `${a.count} productions`,
                    targetType: 'artist',
                    targetId: a.mbid,
                    targetName: a.name,
                  })),
                  ...samplesFrom.slice(0, 4).map((s) => ({
                    type: 'samples material',
                    label: 'samples',
                    targetType: 'recording',
                    targetId: s.rec_mbid,
                    targetName: s.artist_name ? `${s.rec_title} (${s.artist_name})` : s.rec_title,
                  })),
                  ...sampledBy.slice(0, 4).map((s) => ({
                    type: 'sampled by',
                    label: 'sampled by',
                    targetType: 'recording',
                    targetId: s.rec_mbid,
                    targetName: s.artist_name ? `${s.rec_title} (${s.artist_name})` : s.rec_title,
                  })),
                ]}
              />
            </section>
          )}
        </div>
      )}
    </main>
  )
}
