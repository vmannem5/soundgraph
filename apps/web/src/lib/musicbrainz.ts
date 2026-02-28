import { mbRateLimiter } from './rate-limiter'

const MB_BASE = 'https://musicbrainz.org/ws/2'
const USER_AGENT = 'SoundGraph/0.1.0 (soundgraph-app@example.com)'

interface MBSearchResult<T> {
  count: number
  offset: number
  [key: string]: T[] | number
}

async function mbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  await mbRateLimiter.wait()

  const url = new URL(`${MB_BASE}${path}`)
  url.searchParams.set('fmt', 'json')
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  })

  if (!res.ok) {
    throw new Error(`MusicBrainz API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export async function searchArtists(query: string, limit = 10) {
  return mbFetch<MBSearchResult<any>>('/artist', {
    query,
    limit: String(limit),
  })
}

export async function searchRecordings(query: string, limit = 10) {
  return mbFetch<MBSearchResult<any>>('/recording', {
    query,
    limit: String(limit),
  })
}

export async function getArtist(mbid: string) {
  return mbFetch<any>(`/artist/${mbid}`, {
    inc: 'url-rels+tags+ratings+aliases',
  })
}

export async function getRecording(mbid: string) {
  return mbFetch<any>(`/recording/${mbid}`, {
    inc: 'artist-credits+tags+url-rels+artist-rels+recording-rels+work-rels+isrcs',
  })
}

export async function getRelease(mbid: string) {
  return mbFetch<any>(`/release/${mbid}`, {
    inc: 'artist-credits+recordings+tags+url-rels+labels',
  })
}

export async function getReleaseGroup(mbid: string) {
  return mbFetch<any>(`/release-group/${mbid}`, {
    inc: 'artist-credits+tags+url-rels+releases',
  })
}

export async function getArtistRecordings(mbid: string, limit = 25, offset = 0) {
  return mbFetch<any>('/recording', {
    artist: mbid,
    limit: String(limit),
    offset: String(offset),
  })
}

export async function getArtistReleaseGroups(mbid: string, limit = 25) {
  return mbFetch<any>('/release-group', {
    artist: mbid,
    limit: String(limit),
    type: 'album|ep|single',
  })
}
