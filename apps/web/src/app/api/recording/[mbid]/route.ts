import { getRecordingDetails } from '@/lib/data-service'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const { mbid } = await params
  try {
    const recording = await getRecordingDetails(mbid)
    return NextResponse.json(recording)
  } catch (error) {
    console.error('Recording fetch error:', error)
    return NextResponse.json({ error: 'Recording not found' }, { status: 404 })
  }
}
