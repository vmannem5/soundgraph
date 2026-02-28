import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      error: 'Missing Spotify credentials',
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length,
      clientSecretLength: clientSecret?.length,
    })
  }

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: 'Spotify auth failed', status: res.status, data })
    }

    // Test a search
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=radiohead&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${data.access_token}` } }
    )
    const searchData = await searchRes.json()

    return NextResponse.json({
      auth: 'ok',
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      searchResultCount: searchData.tracks?.items?.length ?? 0,
      firstTrack: searchData.tracks?.items?.[0]?.name ?? null,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) })
  }
}
