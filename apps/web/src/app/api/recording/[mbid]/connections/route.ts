import { getRecordingConnections } from '@/lib/data-service'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const { mbid } = await params
  try {
    const data = await getRecordingConnections(mbid)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Connections fetch error:', error)
    return NextResponse.json({ error: 'Connections not found' }, { status: 404 })
  }
}
