import { getArtistDetails } from '@/lib/data-service'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const { mbid } = await params
  try {
    const artist = await getArtistDetails(mbid)
    return NextResponse.json(artist)
  } catch (error) {
    console.error('Artist fetch error:', error)
    return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
  }
}
