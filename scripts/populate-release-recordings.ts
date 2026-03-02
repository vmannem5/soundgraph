/**
 * Populate ReleaseRecording table by fetching release data from MusicBrainz API.
 * Targets top N artists by popularity.
 *
 * Rate limit: 1 req/sec (MB policy). 1000 artists ≈ ~20 min.
 * Run: npx tsx scripts/populate-release-recordings.ts
 *
 * Safe to interrupt and re-run (skips artists already processed).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const LIMIT = 1000   // artists to process
const DELAY_MS = 1100 // 1.1s between requests to stay under MB rate limit
const UA = 'MusicGenus/0.1.0 (musicgenus.com)'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function mbFetch(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (res.status === 503) {
    await sleep(5000)
    return mbFetch(url)
  }
  if (!res.ok) throw new Error(`MB ${res.status}: ${url}`)
  return res.json()
}

async function processArtist(artistMbid: string): Promise<number> {
  // Fetch release groups for this artist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rgData = await mbFetch(`https://musicbrainz.org/ws/2/release-group?artist=${artistMbid}&limit=100&fmt=json`) as any
  const releaseGroups = rgData?.['release-groups'] ?? []
  let inserted = 0

  for (const rg of releaseGroups.slice(0, 10)) { // limit to 10 RGs per artist
    await sleep(DELAY_MS)

    // Fetch releases in this release group with recordings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relData = await mbFetch(`https://musicbrainz.org/ws/2/release?release-group=${rg.id}&inc=recordings&limit=1&fmt=json`) as any
    const releases = relData?.releases ?? []

    for (const rel of releases.slice(0, 1)) { // 1 release per release group
      // Find or create Release in DB
      const dbRelease = await prisma.release.upsert({
        where: { mbid: rel.id },
        create: {
          mbid: rel.id,
          title: rel.title,
          status: rel.status ?? null,
          country: rel.country ?? null,
          date: rel.date ?? null,
          releaseGroupId: null, // will link below if RG exists
        },
        update: {},
      })

      // Link to ReleaseGroup if it exists in DB
      const dbRg = await prisma.releaseGroup.findUnique({ where: { mbid: rg.id } })
      if (dbRg && !dbRelease.releaseGroupId) {
        await prisma.release.update({
          where: { id: dbRelease.id },
          data: { releaseGroupId: dbRg.id },
        })
      }

      // Process tracks/recordings
      const media = rel.media ?? []
      for (const medium of media) {
        const tracks = medium.tracks ?? []
        for (const track of tracks) {
          const recMbid = track.recording?.id
          if (!recMbid) continue

          const dbRecording = await prisma.recording.findUnique({ where: { mbid: recMbid } })
          if (!dbRecording) continue

          // Upsert ReleaseRecording
          await prisma.releaseRecording.upsert({
            where: { releaseId_recordingId: { releaseId: dbRelease.id, recordingId: dbRecording.id } },
            create: {
              releaseId: dbRelease.id,
              recordingId: dbRecording.id,
              position: track.position ?? 0,
              trackTitle: track.title ?? null,
            },
            update: {},
          })
          inserted++
        }
      }
    }
  }
  return inserted
}

async function main() {
  console.log(`Fetching top ${LIMIT} artists...`)

  // Get top artists not yet processed (no ReleaseRecording entries)
  const artists = await prisma.$queryRaw<Array<{ mbid: string; name: string }>>`
    SELECT a.mbid, a.name
    FROM "Artist" a
    WHERE a.popularity > 5
      AND NOT EXISTS (
        SELECT 1 FROM "ReleaseRecording" rr
        JOIN "Release" rel ON rel.id = rr."releaseId"
        JOIN "Credit" c ON c."recordingId" = rr."recordingId" AND c."artistId" = a.id
        LIMIT 1
      )
    ORDER BY a.popularity DESC
    LIMIT ${LIMIT}
  `

  console.log(`Processing ${artists.length} artists...`)
  let totalInserted = 0
  let processed = 0

  for (const artist of artists) {
    try {
      const n = await processArtist(artist.mbid)
      totalInserted += n
      processed++
      if (processed % 50 === 0) {
        const rrCount = await prisma.releaseRecording.count()
        console.log(`  ${processed}/${artists.length} — ${rrCount.toLocaleString()} ReleaseRecording rows total`)
      }
    } catch (e) {
      console.error(`  Skipping ${artist.name}: ${e}`)
    }
    await sleep(DELAY_MS)
  }

  const total = await prisma.releaseRecording.count()
  console.log(`\nDone! ReleaseRecording rows: ${total.toLocaleString()}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
