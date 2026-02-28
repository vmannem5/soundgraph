let accessToken: string | null = null
let tokenExpiry = 0

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiry) {
    return accessToken
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })

  const data = await res.json()
  accessToken = data.access_token
  tokenExpiry = Date.now() + data.expires_in * 1000 - 60_000 // Refresh 1 min early
  return accessToken!
}

async function spotifyFetch<T>(path: string): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`Spotify API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export async function searchSpotify(query: string, types = 'track,artist,album', limit = 5) {
  return spotifyFetch<any>(
    `/search?q=${encodeURIComponent(query)}&type=${types}&limit=${limit}`
  )
}

export async function getSpotifyTrack(id: string) {
  return spotifyFetch<any>(`/tracks/${id}`)
}

export async function getSpotifyArtist(id: string) {
  return spotifyFetch<any>(`/artists/${id}`)
}

export async function getSpotifyAlbum(id: string) {
  return spotifyFetch<any>(`/albums/${id}`)
}

export async function searchByIsrc(isrc: string) {
  return spotifyFetch<any>(
    `/search?q=isrc:${isrc}&type=track&limit=1`
  )
}

export async function getSpotifyArtistTopTracks(id: string, market = 'US') {
  return spotifyFetch<any>(`/artists/${id}/top-tracks?market=${market}`)
}
