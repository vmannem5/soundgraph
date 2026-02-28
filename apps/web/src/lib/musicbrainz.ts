import { mbRateLimiter } from './rate-limiter'

const MB_BASE = 'https://musicbrainz.org/ws/2'
const USER_AGENT = 'SoundGraph/0.1.0 (soundgraph-app@example.com)'

// Detect if we're running on Vercel (serverless) vs local dev
const IS_VERCEL = !!process.env.VERCEL

interface MBSearchResult<T> {
  count: number
  offset: number
  [key: string]: T[] | number
}

async function mbFetchWithCurl<T>(url: URL): Promise<T> {
  const { execFileSync } = await import('node:child_process')
  const result = execFileSync('curl', [
    '-4', '-s', '--max-time', '10',
    '-H', `User-Agent: ${USER_AGENT}`,
    url.toString(),
  ], { encoding: 'utf-8', timeout: 15000 })

  const data = JSON.parse(result)
  if (data.error) {
    throw new Error(`MusicBrainz API error: ${data.error}`)
  }
  return data as T
}

async function mbFetchWithFetch<T>(url: URL): Promise<T> {
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
  })

  if (!res.ok) {
    throw new Error(`MusicBrainz API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

async function mbFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  await mbRateLimiter.wait()

  const url = new URL(`${MB_BASE}${path}`)
  url.searchParams.set('fmt', 'json')
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  // On Vercel (Node.js 20), use native fetch directly — no TLS issues.
  // Locally (Node.js v25), use curl workaround for TLS incompatibility with MusicBrainz.
  if (IS_VERCEL) {
    return mbFetchWithFetch<T>(url)
  }

  try {
    return await mbFetchWithCurl<T>(url)
  } catch {
    // Fallback to native fetch if curl is not available
    return mbFetchWithFetch<T>(url)
  }
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
