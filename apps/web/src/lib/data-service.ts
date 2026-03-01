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

  // Fast GIN-indexed full-text search on DB, ranked by pre-computed popularity score
  const [dbArtists, dbRecordings] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string; mbid: string; name: string; type: string | null
      country: string | null; disambiguation: string | null; rank: number
    }>>`
      SELECT id, mbid, name, type, country, disambiguation,
             COALESCE(popularity, 0) AS rank
      FROM "Artist"
      WHERE "search_vector" @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC
      LIMIT 10
    `.catch(() => []),

    prisma.$queryRaw<Array<{
      id: string; mbid: string; title: string; length: number | null; rank: number
    }>>`
      SELECT id, mbid, title, length,
             COALESCE(popularity, 0) AS rank
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
                   COALESCE(popularity, 0) AS rank
            FROM "Artist" WHERE name % ${sanitized}
            ORDER BY rank DESC LIMIT 5
          `.catch(() => [])
        : Promise.resolve([] as typeof dbArtists),
      dbRecordings.length < MIN_DB_RESULTS
        ? prisma.$queryRaw<typeof dbRecordings>`
            SELECT id, mbid, title, length,
                   COALESCE(popularity, 0) AS rank
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

  // Always call Spotify for popularity-based re-ranking + images
  const needMbApi = allArtists.length < MIN_DB_RESULTS || allRecordings.length < MIN_DB_RESULTS
  const [mbA, mbR, spRes] = await Promise.all([
    needMbApi && allArtists.length < MIN_DB_RESULTS ? mb.searchArtists(query, 5).catch(() => null) : null,
    needMbApi && allRecordings.length < MIN_DB_RESULTS ? mb.searchRecordings(query, 5).catch(() => null) : null,
    spotify.searchSpotify(query, 'track,artist', 10).catch(() => null),
  ])
  const mbArtistsList: any[] = (mbA?.artists as any[]) || []
  const mbRecordingsList: any[] = (mbR?.recordings as any[]) || []
  const spotifyTracks: any[] = spRes?.tracks?.items || []
  const spotifyArtists: any[] = spRes?.artists?.items || []

  // Build Spotify lookup maps keyed by "title::artist" for precise matching
  const spTracksByTitleArtist = new Map<string, { popularity: number; artists: string[] }>()
  const spTracksByTitle = new Map<string, number>()
  spotifyTracks.forEach((t: any) => {
    const title = t.name?.toLowerCase()
    if (!title) return
    const artists = (t.artists || []).map((a: any) => a.name?.toLowerCase()).filter(Boolean)
    artists.forEach((artist: string) => {
      const key = `${title}::${artist}`
      const existing = spTracksByTitleArtist.get(key)
      if (!existing || t.popularity > existing.popularity) {
        spTracksByTitleArtist.set(key, { popularity: t.popularity || 0, artists })
      }
    })
    spTracksByTitle.set(title, Math.max(spTracksByTitle.get(title) || 0, t.popularity || 0))
  })
  const spArtistMap = new Map<string, number>()
  spotifyArtists.forEach((a: any) => {
    const key = a.name?.toLowerCase()
    if (key && a.popularity) spArtistMap.set(key, Math.max(spArtistMap.get(key) || 0, a.popularity))
  })

  // Re-rank DB recordings using Spotify popularity with title+artist matching
  const boostedRecordings = dbRecordingsMapped.map(r => {
    const title = r.title?.toLowerCase()
    const dbArtists = (r['artist-credit'] || []).map((c: any) => c.name?.toLowerCase()).filter(Boolean)

    // Best match: exact title+artist combo from Spotify
    let bestPop = 0
    for (const artist of dbArtists) {
      const match = spTracksByTitleArtist.get(`${title}::${artist}`)
      if (match && match.popularity > bestPop) bestPop = match.popularity
    }
    // Fallback: title-only match (weaker signal)
    if (bestPop === 0) bestPop = (spTracksByTitle.get(title) || 0) * 0.3

    return { ...r, _sortScore: bestPop }
  }).sort((a, b) => b._sortScore - a._sortScore)

  // Re-rank DB artists with Spotify popularity
  const boostedArtists = dbArtistsMapped.map(a => {
    const spPop = spArtistMap.get(a.name?.toLowerCase()) || 0
    return { ...a, _sortScore: spPop }
  }).sort((a, b) => b._sortScore - a._sortScore)

  const dbArtistMbids = new Set(allArtists.map(a => a.mbid))
  const dbRecordingMbids = new Set(allRecordings.map(r => r.mbid))

  return {
    artists: [...boostedArtists, ...mbArtistsList.filter((a: any) => !dbArtistMbids.has(a.id))].slice(0, 10),
    recordings: [...boostedRecordings, ...mbRecordingsList.filter((r: any) => !dbRecordingMbids.has(r.id))].slice(0, 10),
    spotifyTracks,
    spotifyArtists,
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

  // Check API cache
  const key = cacheKey('mb', 'artist', mbid)
  const cached = await getCached<Record<string, unknown>>(key)
  if (cached) {
    if (dbArtist) {
      (cached as any).tags = (cached as any).tags || dbArtist.tags.map(t => ({ name: t.tag, count: t.count }))
    }
    return cached
  }

  // Try MB API (may fail due to rate limits or TLS issues)
  try {
    const artist = await mb.getArtist(mbid)

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

    const result: any = { ...artist, spotifyData }
    if (dbArtist && (!result.tags || result.tags.length === 0)) {
      result.tags = dbArtist.tags.map(t => ({ name: t.tag, count: t.count }))
    }

    await setCache(key, result as Prisma.InputJsonValue, 'musicbrainz')
    return result
  } catch {
    // API failed — serve from DB if available
    if (dbArtist) {
      return {
        id: dbArtist.mbid,
        name: dbArtist.name,
        'sort-name': dbArtist.sortName,
        type: dbArtist.type,
        country: dbArtist.country,
        disambiguation: dbArtist.disambiguation,
        tags: dbArtist.tags.map(t => ({ name: t.tag, count: t.count })),
        aliases: dbArtist.aliases.map(a => ({ name: a.name, locale: a.locale })),
        _fromDb: true,
      }
    }
    throw new Error('Artist not found')
  }
}

export async function getRecordingDetails(mbid: string) {
  const key = cacheKey('mb', 'recording', mbid)
  const cached = await getCached<Record<string, unknown>>(key)
  if (cached) return cached

  // Try DB first for basic data
  const dbRecording = await prisma.recording.findUnique({
    where: { mbid },
    include: {
      credits: { include: { artist: true }, where: { role: 'performer' } },
      tags: { orderBy: { count: 'desc' }, take: 10 },
    },
  }).catch(() => null)

  // Try MB API
  try {
    const recording = await mb.getRecording(mbid)

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
  } catch {
    // API failed — serve from DB
    if (dbRecording) {
      // Try Spotify enrichment via ISRC
      let spotifyData = null
      if (dbRecording.isrc) {
        const results = await spotify.searchByIsrc(dbRecording.isrc).catch(() => null)
        if (results?.tracks?.items?.length > 0) {
          spotifyData = results.tracks.items[0]
        }
      }

      return {
        id: dbRecording.mbid,
        title: dbRecording.title,
        length: dbRecording.length,
        isrcs: dbRecording.isrc ? [dbRecording.isrc] : [],
        'artist-credit': dbRecording.credits.map(c => ({
          name: c.artist.name,
          artist: { id: c.artist.mbid, name: c.artist.name },
        })),
        tags: dbRecording.tags.map(t => ({ name: t.tag, count: t.count })),
        spotifyData,
        _fromDb: true,
      }
    }
    throw new Error('Recording not found')
  }
}

export async function getRecordingConnections(mbid: string) {
  let recording: any
  try {
    recording = await getRecordingDetails(mbid)
  } catch {
    // Minimal recording object if everything fails
    const dbRec = await prisma.recording.findUnique({ where: { mbid } }).catch(() => null)
    recording = dbRec ? { id: dbRec.mbid, title: dbRec.title, length: dbRec.length } : { id: mbid, title: 'Unknown' }
  }

  const connections: {
    type: string
    label: string
    targetType: 'artist' | 'recording' | 'tag' | 'work'
    targetId: string
    targetName: string
    attributes?: string[]
    importance?: number
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
        importance: credit.artist.popularity || 0,
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
        importance: sample.sampledTrack.popularity || 0,
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
        importance: sample.samplingTrack.popularity || 0,
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

export async function getArtistConnections(mbid: string) {
  try {
    const [topCollaborators, topProducers, samplesFrom, sampledBy] = await Promise.all([
      // Top collaborators: artists who share recordings with this artist
      prisma.$queryRaw<Array<{ mbid: string; name: string; count: number }>>`
        SELECT a2.mbid, a2.name, count(DISTINCT c1."recordingId")::int as count
        FROM "Artist" a1
        JOIN "Credit" c1 ON c1."artistId" = a1.id
        JOIN "Credit" c2 ON c2."recordingId" = c1."recordingId" AND c2."artistId" != a1.id
        JOIN "Artist" a2 ON a2.id = c2."artistId"
        WHERE a1.mbid = ${mbid}
        GROUP BY a2.id, a2.mbid, a2.name
        ORDER BY count DESC
        LIMIT 12
      `.catch(() => []),

      // Top producers of this artist's recordings
      prisma.$queryRaw<Array<{ mbid: string; name: string; count: number }>>`
        SELECT a2.mbid, a2.name, count(DISTINCT c1."recordingId")::int as count
        FROM "Artist" a1
        JOIN "Credit" c1 ON c1."artistId" = a1.id
        JOIN "Credit" c2 ON c2."recordingId" = c1."recordingId"
          AND c2.role = 'producer' AND c2."artistId" != a1.id
        JOIN "Artist" a2 ON a2.id = c2."artistId"
        WHERE a1.mbid = ${mbid}
        GROUP BY a2.id, a2.mbid, a2.name
        ORDER BY count DESC
        LIMIT 8
      `.catch(() => []),

      // Recordings this artist has sampled (this artist = samplingTrack)
      prisma.$queryRaw<Array<{
        rec_mbid: string; rec_title: string
        artist_mbid: string | null; artist_name: string | null
        popularity: number | null
      }>>`
        SELECT r_sampled.mbid as rec_mbid, r_sampled.title as rec_title,
               MIN(a_src.mbid) as artist_mbid, MIN(a_src.name) as artist_name,
               r_sampled.popularity as popularity
        FROM "Artist" a
        JOIN "Credit" c ON c."artistId" = a.id
        JOIN "Recording" r ON r.id = c."recordingId"
        JOIN "SampleRelation" sr ON sr."samplingTrackId" = r.id
        JOIN "Recording" r_sampled ON r_sampled.id = sr."sampledTrackId"
        LEFT JOIN "Credit" c_src ON c_src."recordingId" = r_sampled.id AND c_src.role = 'performer'
        LEFT JOIN "Artist" a_src ON a_src.id = c_src."artistId" AND a_src.mbid != ${mbid}
        WHERE a.mbid = ${mbid}
        GROUP BY r_sampled.id, r_sampled.mbid, r_sampled.title, r_sampled.popularity
        ORDER BY r_sampled.popularity DESC NULLS LAST
        LIMIT 10
      `.catch(() => []),

      // Recordings that sampled this artist's music (this artist = sampledTrack)
      prisma.$queryRaw<Array<{
        rec_mbid: string; rec_title: string
        artist_mbid: string | null; artist_name: string | null
        popularity: number | null
      }>>`
        SELECT r_sampling.mbid as rec_mbid, r_sampling.title as rec_title,
               MIN(a_dest.mbid) as artist_mbid, MIN(a_dest.name) as artist_name,
               r_sampling.popularity as popularity
        FROM "Artist" a
        JOIN "Credit" c ON c."artistId" = a.id
        JOIN "Recording" r ON r.id = c."recordingId"
        JOIN "SampleRelation" sr ON sr."sampledTrackId" = r.id
        JOIN "Recording" r_sampling ON r_sampling.id = sr."samplingTrackId"
        LEFT JOIN "Credit" c_dest ON c_dest."recordingId" = r_sampling.id AND c_dest.role = 'performer'
        LEFT JOIN "Artist" a_dest ON a_dest.id = c_dest."artistId" AND a_dest.mbid != ${mbid}
        WHERE a.mbid = ${mbid}
        GROUP BY r_sampling.id, r_sampling.mbid, r_sampling.title, r_sampling.popularity
        ORDER BY r_sampling.popularity DESC NULLS LAST
        LIMIT 10
      `.catch(() => []),
    ])
    return { topCollaborators, topProducers, samplesFrom, sampledBy }
  } catch {
    return { topCollaborators: [], topProducers: [], samplesFrom: [], sampledBy: [] }
  }
}

export async function getDiscoveryData() {
  try {
    const [mostSampled, topProducers] = await Promise.all([
      prisma.$queryRaw<Array<{
        mbid: string; title: string; sample_count: number
      }>>`
        SELECT r.mbid, r.title, count(sr.id)::int as sample_count
        FROM "Recording" r
        JOIN "SampleRelation" sr ON sr."sampledTrackId" = r.id
        WHERE r.popularity > 20
        GROUP BY r.id, r.mbid, r.title
        ORDER BY sample_count DESC, r.popularity DESC
        LIMIT 20
      `,
      prisma.$queryRaw<Array<{
        mbid: string; name: string; credit_count: number
      }>>`
        SELECT a.mbid, a.name, count(c.id)::int as credit_count
        FROM "Artist" a
        JOIN "Credit" c ON c."artistId" = a.id
        WHERE c.role = 'producer'
        GROUP BY a.id, a.mbid, a.name
        ORDER BY credit_count DESC
        LIMIT 12
      `,
    ])
    return { mostSampled, topProducers }
  } catch {
    return { mostSampled: [], topProducers: [] }
  }
}
