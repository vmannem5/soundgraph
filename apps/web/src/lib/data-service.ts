import { prisma } from '@soundgraph/database'
import type { Prisma } from '@soundgraph/database'
import * as mb from './musicbrainz'

const CACHE_TTL_HOURS = 24 * 7 // 1 week cache

function cacheKey(source: string, type: string, id: string) {
  return `${source}:${type}:${id}`
}

async function getCached<T>(key: string): Promise<T | null> {
  const cached = await prisma.apiCache.findUnique({ where: { key } })
  if (cached && cached.expiresAt > new Date()) {
    return cached.data as T
  }
  return null
}

async function setCache(key: string, data: Prisma.InputJsonValue, source: string) {
  const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000)
  await prisma.apiCache.upsert({
    where: { key },
    update: { data, expiresAt },
    create: { key, data, source, expiresAt },
  })
}

// === Public API ===

export async function searchAll(query: string) {
  // Search MusicBrainz (Spotify search deferred — will be added as parallel Promise.all call)
  const [mbArtists, mbRecordings] = await Promise.all([
    mb.searchArtists(query, 5),
    mb.searchRecordings(query, 5),
  ])

  return {
    artists: mbArtists.artists || [],
    recordings: mbRecordings.recordings || [],
    // TODO: Add spotifyTracks and spotifyArtists when Spotify client is ready
  }
}

export async function getArtistDetails(mbid: string) {
  const key = cacheKey('mb', 'artist', mbid)
  const cached = await getCached<Record<string, unknown>>(key)
  if (cached) return cached

  const artist = await mb.getArtist(mbid)

  // TODO: Spotify enrichment — look for Spotify URL in artist.relations,
  // extract Spotify artist ID, fetch images/popularity via spotify.getSpotifyArtist()
  // For now, spotifyData is null
  const result = { ...artist, spotifyData: null }
  await setCache(key, result as Prisma.InputJsonValue, 'musicbrainz')
  return result
}

export async function getRecordingDetails(mbid: string) {
  const key = cacheKey('mb', 'recording', mbid)
  const cached = await getCached<Record<string, unknown>>(key)
  if (cached) return cached

  const recording = await mb.getRecording(mbid)

  // TODO: Spotify enrichment — use recording.isrcs[0] to search Spotify via searchByIsrc()
  // to get album art, preview URL, popularity
  // For now, spotifyData is null
  const result = { ...recording, spotifyData: null }
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
