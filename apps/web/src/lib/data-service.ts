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
  } catch (error) {
    // Database unreachable (e.g., Vercel serverless can't reach Supabase direct connection)
    // Gracefully skip cache and fall through to API fetch
    console.warn('Cache read failed (DB unreachable), skipping:', (error as Error).message?.slice(0, 100))
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
  } catch (error) {
    // Database unreachable — skip caching, data will be fetched fresh next time
    console.warn('Cache write failed (DB unreachable), skipping:', (error as Error).message?.slice(0, 100))
  }
}

// === Public API ===

export async function searchAll(query: string) {
  const [mbArtists, mbRecordings, spotifyResults] = await Promise.all([
    mb.searchArtists(query, 5).catch(() => null),
    mb.searchRecordings(query, 5).catch(() => null),
    spotify.searchSpotify(query, 'track,artist', 5).catch(() => null),
  ])

  return {
    artists: (mbArtists?.artists as any[]) || [],
    recordings: (mbRecordings?.recordings as any[]) || [],
    spotifyTracks: spotifyResults?.tracks?.items || [],
    spotifyArtists: spotifyResults?.artists?.items || [],
  }
}

export async function getArtistDetails(mbid: string) {
  const key = cacheKey('mb', 'artist', mbid)
  const cached = await getCached<Record<string, unknown>>(key)
  if (cached) return cached

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

  const result = { ...artist, spotifyData }
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

  // Extract connections from MusicBrainz relations
  const connections: {
    type: string
    label: string
    targetType: string
    targetId: string
    targetName: string
    attributes?: string[]
  }[] = []

  // Artist credits (performers)
  const artistCredits = recording['artist-credit'] as Array<Record<string, unknown>> | undefined
  artistCredits?.forEach((credit) => {
    const artist = credit.artist as Record<string, unknown>
    connections.push({
      type: 'performer',
      label: credit.joinphrase ? `performer${credit.joinphrase}` : 'performer',
      targetType: 'artist',
      targetId: artist.id as string,
      targetName: artist.name as string,
    })
  })

  // Relations (producers, engineers, samples, etc.)
  const relations = recording.relations as Array<Record<string, unknown>> | undefined
  relations?.forEach((rel) => {
    if (rel['target-type'] === 'artist') {
      const artist = rel.artist as Record<string, unknown>
      connections.push({
        type: rel.type as string,
        label: rel.type as string,
        targetType: 'artist',
        targetId: artist.id as string,
        targetName: artist.name as string,
        attributes: rel.attributes as string[] | undefined,
      })
    }
    if (rel['target-type'] === 'recording') {
      const rec = rel.recording as Record<string, unknown>
      connections.push({
        type: rel.type as string,
        label: rel.type as string,
        targetType: 'recording',
        targetId: rec.id as string,
        targetName: rec.title as string,
        attributes: rel.attributes as string[] | undefined,
      })
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
