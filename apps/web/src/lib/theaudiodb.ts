const API_KEY = '2' // Free test key
const BASE_URL = 'https://www.theaudiodb.com/api/v1/json'

interface TheAudioDBArtist {
  idArtist: string
  strArtist: string
  strArtistThumb?: string
  strArtistLogo?: string
  strArtistClearart?: string
  strArtistWideThumb?: string
}

interface TheAudioDBResponse {
  artists?: TheAudioDBArtist[]
}

export async function getArtistByMBID(mbid: string): Promise<TheAudioDBArtist | null> {
  try {
    const res = await fetch(`${BASE_URL}/${API_KEY}/artist-mb.php?i=${mbid}`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return null
    const data: TheAudioDBResponse = await res.json()
    return data.artists?.[0] ?? null
  } catch {
    return null
  }
}

export function getBestImage(artist: TheAudioDBArtist | null): string | null {
  if (!artist) return null
  return (
    artist.strArtistClearart ??
    artist.strArtistThumb ??
    artist.strArtistLogo ??
    artist.strArtistWideThumb ??
    null
  )
}
