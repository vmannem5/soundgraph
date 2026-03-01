import { prisma } from '@soundgraph/database'
import type { Prisma } from '@soundgraph/database'
import * as mb from './musicbrainz'
import * as spotify from './spotify'

const CACHE_TTL_HOURS = 24 * 7 // 1 week cache

function cacheKey(source: string, type: string, id: string) {
  return `${source}:${type}:${id}`
}

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await prisma.apiCache.findUnique({ where: { key } })
    if (cached && cached.expiresAt > new Date()) {
      return cached.data as T
    }
  } catch {
    // Database unreachable — skip cache
  }
  return null
}

async function setCache(key: string, data: Prisma.InputJsonValue, source: string) {
  try {
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000)
    await prisma.apiCache.upsert({
      where: { key },
      update: { data, expiresAt },
      create: { key, data, source, expiresAt },
    })
  } catch {
    // Database unreachable — skip caching
  }
}

// === Public API ===

export async function searchAll(query: string) {
  const MIN_DB_RESULTS = 3

  const sanitized = query.trim().replace(/[^\w\s]/g, '').trim()
  if (!sanitized) {
    return { artists: [], recordings: [], spotifyTracks: [], spotifyArtists: [] }
  }

  // Full-text search: "miles davis" => "miles:* & davis:*" (prefix match with AND)
  const tsQuery = sanitized.split(/\s+/).map(t => `${t}:*`).join(' & ')

  // Fast GIN-indexed full-text search on DB
  const [dbArtists, dbRecordings] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string; mbid: string; name: string; type: string | null
      country: string | null; disambiguation: string | null; rank: number
    }>>`
      SELECT id, mbid, name, type, country, disambiguation,
             ts_rank("search_vector", to_tsquery('english', ${tsQuery})) AS rank
      FROM "Artist"
      WHERE "search_vector" @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC
      LIMIT 10
    `.catch(() => []),

    prisma.$queryRaw<Array<{
      id: string; mbid: string; title: string; length: number | null; rank: number
    }>>`
      SELECT id, mbid, title, length,
             ts_rank("search_vector", to_tsquery('english', ${tsQuery})) AS rank
      FROM "Recording"
      WHERE "search_vector" @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC
      LIMIT 10
    `.catch(() => []),
  ])

  // Trigram fallback for typos when full-text returns too few results
  let allArtists = dbArtists
  let allRecordings = dbRecordings
  if (dbArtists.length < MIN_DB_RESULTS || dbRecordings.length < MIN_DB_RESULTS) {
    const existingArtistMbids = new Set(dbArtists.map(a => a.mbid))
    const existingRecMbids = new Set(dbRecordings.map(r => r.mbid))
    const [trgArtists, trgRecordings] = await Promise.all([
      dbArtists.length < MIN_DB_RESULTS
        ? prisma.$queryRaw<typeof dbArtists>`
            SELECT id, mbid, name, type, country, disambiguation,
                   similarity(name, ${sanitized}) AS rank
            FROM "Artist" WHERE name % ${sanitized}
            ORDER BY rank DESC LIMIT 5
          `.catch(() => [])
        : Promise.resolve([] as typeof dbArtists),
      dbRecordings.length < MIN_DB_RESULTS
        ? prisma.$queryRaw<typeof dbRecordings>`
            SELECT id, mbid, title, length,
                   similarity(title, ${sanitized}) AS rank
            FROM "Recording" WHERE title % ${sanitized}
            ORDER BY rank DESC LIMIT 5
          `.catch(() => [])
        : Promise.resolve([] as typeof dbRecordings),
    ])
    allArtists = [...dbArtists, ...trgArtists.filter(a => !existingArtistMbids.has(a.mbid))]
    allRecordings = [...dbRecordings, ...trgRecordings.filter(r => !existingRecMbids.has(r.mbid))]
  }

  // Batch-fetch performer credits for matched recordings
  const creditsByRecId = new Map<string, Array<{ artist: { mbid: string; name: string } }>>()
  if (allRecordings.length > 0) {
    const credits = await prisma.credit.findMany({
      where: { recordingId: { in: allRecordings.map(r => r.id) }, role: 'performer' },
      include: { artist: { select: { mbid: true, name: true } } },
    }).catch(() => [])
    for (const c of credits) {
      const arr = creditsByRecId.get(c.recordingId) || []
      arr.push(c)
      creditsByRecId.set(c.recordingId, arr)
    }
  }

  // Map to existing output format
  const dbArtistsMapped = allArtists.map(a => ({
    id: a.mbid, name: a.name, type: a.type, country: a.country,
    disambiguation: a.disambiguation, _fromDb: true,
  }))
  const dbRecordingsMapped = allRecordings.map(r => ({
    id: r.mbid, title: r.title, length: r.length,
    'artist-credit': (creditsByRecId.get(r.id) || []).map(c => ({
      name: c.artist.name, artist: { id: c.artist.mbid, name: c.artist.name },
    })),
    _fromDb: true,
  }))

  // Only call external APIs if DB results are sparse
  const needApi = allArtists.length < MIN_DB_RESULTS || allRecordings.length < MIN_DB_RESULTS
  let mbArtistsList: any[] = []
  let mbRecordingsList: any[] = []
  let spotifyResults: any = null

  if (needApi) {
    const [mbA, mbR, spRes] = await Promise.all([
      allArtists.length < MIN_DB_RESULTS ? mb.searchArtists(query, 5).catch(() => null) : null,
      allRecordings.length < MIN_DB_RESULTS ? mb.searchRecordings(query, 5).catch(() => null) : null,
      spotify.searchSpotify(query, 'track,artist', 5).catch(() => null),
    ])
    mbArtistsList = (mbA?.artists as any[]) || []
    mbRecordingsList = (mbR?.recordings as any[]) || []
    spotifyResults = spRes
  }

  const dbArtistMbids = new Set(allArtists.map(a => a.mbid))
  const dbRecordingMbids = new Set(allRecordings.map(r => r.mbid))

  return {
    artists: [...dbArtistsMapped, ...mbArtistsList.filter((a: any) => !dbArtistMbids.has(a.id))].slice(0, 10),
    recordings: [...dbRecordingsMapped, ...mbRecordingsList.filter((r: any) => !dbRecordingMbids.has(r.id))].slice(0, 10),
    spotifyTracks: spotifyResults?.tracks?.items || [],
    spotifyArtists: spotifyResults?.artists?.items || [],
  }
}

export async function getArtistDetails(mbid: string) {
  // Try DB first
  const dbArtist = await prisma.artist.findUnique({
    where: { mbid },
    include: {
      tags: { orderBy: { count: 'desc' }, take: 15 },
      aliases: { take: 10 },
    },
  }).catch(() => null)

  // Always fetch from MB API for full details (has relations, life-span, etc.)
  const key = cacheKey('mb', 'artist', mbid)
  const cached = await getCached<Record<string, unknown>>(key)
  if (cached) {
    // Enrich cached data with DB data
    if (dbArtist) {
      (cached as any).tags = (cached as any).tags || dbArtist.tags.map(t => ({ name: t.tag, count: t.count }))
    }
    return cached
  }

  const artist = await mb.getArtist(mbid)

  // Try to find Spotify data via URL relations
  const spotifyUrl = artist.relations?.find(
    (r: any) => (r.type === 'streaming' || r.type === 'free streaming') && r.url?.resource?.includes('spotify.com')
  )
  let spotifyData = null
  if (spotifyUrl) {
    const spotifyId = spotifyUrl.url.resource.match(/artist\/([a-zA-Z0-9]+)/)?.[1]
    if (spotifyId) {
      spotifyData = await spotify.getSpotifyArtist(spotifyId).catch(() => null)
    }
  }

  // Merge DB tags if MB tags are sparse
  const result: any = { ...artist, spotifyData }
  if (dbArtist && (!result.tags || result.tags.length === 0)) {
    result.tags = dbArtist.tags.map(t => ({ name: t.tag, count: t.count }))
  }

  await setCache(key, result as Prisma.InputJsonValue, 'musicbrainz')
  return result
}

export async function getRecordingDetails(mbid: string) {
  const key = cacheKey('mb', 'recording', mbid)
  const cached = await getCached<Record<string, unknown>>(key)
  if (cached) return cached

  const recording = await mb.getRecording(mbid)

  // Try to enrich with Spotify data via ISRC
  let spotifyData = null
  if (recording.isrcs?.length > 0) {
    const isrc = recording.isrcs[0]
    const results = await spotify.searchByIsrc(isrc).catch(() => null)
    if (results?.tracks?.items?.length > 0) {
      spotifyData = results.tracks.items[0]
    }
  }

  const result = { ...recording, spotifyData }
  await setCache(key, result as Prisma.InputJsonValue, 'musicbrainz')
  return result
}

export async function getRecordingConnections(mbid: string) {
  const recording = await getRecordingDetails(mbid)

  const connections: {
    type: string
    label: string
    targetType: string
    targetId: string
    targetName: string
    attributes?: string[]
  }[] = []

  // === DB connections (from Prisma — includes samples, credits) ===
  const dbRecording = await prisma.recording.findUnique({
    where: { mbid },
    include: {
      credits: { include: { artist: true } },
      samplesUsed: { include: { sampledTrack: { include: { credits: { include: { artist: true }, where: { role: 'performer' }, take: 1 } } } } },
      sampledBy: { include: { samplingTrack: { include: { credits: { include: { artist: true }, where: { role: 'performer' }, take: 1 } } } } },
      tags: { orderBy: { count: 'desc' }, take: 10 },
    },
  }).catch(() => null)

  if (dbRecording) {
    // Credits from DB
    for (const credit of dbRecording.credits) {
      connections.push({
        type: credit.role,
        label: credit.role,
        targetType: 'artist',
        targetId: credit.artist.mbid,
        targetName: credit.artist.name,
        attributes: credit.instrument ? [credit.instrument] : undefined,
      })
    }

    // Samples used (this track samples other tracks)
    for (const sample of dbRecording.samplesUsed) {
      const artistName = sample.sampledTrack.credits[0]?.artist.name || ''
      connections.push({
        type: 'samples material',
        label: 'samples',
        targetType: 'recording',
        targetId: sample.sampledTrack.mbid,
        targetName: `${sample.sampledTrack.title}${artistName ? ` (${artistName})` : ''}`,
      })
    }

    // Sampled by (other tracks sample this track)
    for (const sample of dbRecording.sampledBy) {
      const artistName = sample.samplingTrack.credits[0]?.artist.name || ''
      connections.push({
        type: 'sampled by',
        label: 'sampled by',
        targetType: 'recording',
        targetId: sample.samplingTrack.mbid,
        targetName: `${sample.samplingTrack.title}${artistName ? ` (${artistName})` : ''}`,
      })
    }
  }

  // === API connections (from MusicBrainz relations) ===
  const dbConnectionIds = new Set(connections.map(c => `${c.targetId}-${c.type}`))

  // Artist credits (performers) from MB
  const artistCredits = recording['artist-credit'] as Array<Record<string, unknown>> | undefined
  artistCredits?.forEach((credit) => {
    const artist = credit.artist as Record<string, unknown>
    const key = `${artist.id}-performer`
    if (!dbConnectionIds.has(key)) {
      connections.push({
        type: 'performer',
        label: credit.joinphrase ? `performer${credit.joinphrase}` : 'performer',
        targetType: 'artist',
        targetId: artist.id as string,
        targetName: artist.name as string,
      })
    }
  })

  // Relations (producers, engineers, samples, etc.) from MB
  const relations = recording.relations as Array<Record<string, unknown>> | undefined
  relations?.forEach((rel) => {
    if (rel['target-type'] === 'artist') {
      const artist = rel.artist as Record<string, unknown>
      const key = `${artist.id}-${rel.type}`
      if (!dbConnectionIds.has(key)) {
        connections.push({
          type: rel.type as string,
          label: rel.type as string,
          targetType: 'artist',
          targetId: artist.id as string,
          targetName: artist.name as string,
          attributes: rel.attributes as string[] | undefined,
        })
      }
    }
    if (rel['target-type'] === 'recording') {
      const rec = rel.recording as Record<string, unknown>
      const key = `${rec.id}-${rel.type}`
      if (!dbConnectionIds.has(key)) {
        connections.push({
          type: rel.type as string,
          label: rel.type as string,
          targetType: 'recording',
          targetId: rec.id as string,
          targetName: rec.title as string,
          attributes: rel.attributes as string[] | undefined,
        })
      }
    }
    if (rel['target-type'] === 'work') {
      const work = rel.work as Record<string, unknown>
      connections.push({
        type: rel.type as string,
        label: rel.type as string,
        targetType: 'work',
        targetId: work.id as string,
        targetName: work.title as string,
      })
    }
  })

  return { recording, connections }
}
