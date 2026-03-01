/**
 * Bulk compute SoundProfile for all artists with popularity > 0.
 * Uses pre-aggregated CTEs for efficiency — far faster than the per-batch
 * approach in seed-genus.ts.
 *
 * Run: npx tsx scripts/seed-profiles-bulk.ts
 * (from monorepo root, on the server — may take 20-40 min for 50K artists)
 *
 * Safe to interrupt and re-run — upserts are idempotent.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Same global max constants as seed-genus.ts
const GLOBAL_MAX = {
  genreBreadth:   50,
  sampleUse:      20,
  collabRadius:   200,
  instrDiversity: 20,
}

const BATCH = 500   // artists per batch
const LIMIT = 50000 // total artists to process (top N by popularity)

async function main() {
  console.log(`Loading top ${LIMIT} artists by popularity...`)

  // Get top artists not yet profiled
  const artists = await prisma.$queryRaw<Array<{ mbid: string; id: string }>>`
    SELECT a.mbid, a.id
    FROM "Artist" a
    WHERE a.popularity > 0
      AND NOT EXISTS (
        SELECT 1 FROM "SoundProfile" sp WHERE sp."entityMbid" = a.mbid
      )
    ORDER BY a.popularity DESC
    LIMIT ${LIMIT}
  `

  console.log(`Found ${artists.length} artists without profiles. Processing in batches of ${BATCH}...`)

  let processed = 0

  for (let i = 0; i < artists.length; i += BATCH) {
    const batch = artists.slice(i, i + BATCH)
    const ids = batch.map(a => a.id)
    const mbids = batch.map(a => a.mbid)

    // Compute all axes in a single query using CTEs
    const profiles = await prisma.$queryRaw<Array<{
      mbid: string
      genre_breadth: bigint
      sample_use: bigint
      collab_radius: bigint
      instrument_diversity: bigint
    }>>`
      WITH
        tag_counts AS (
          SELECT "artistId", COUNT(DISTINCT tag)::bigint AS cnt
          FROM "ArtistTag"
          WHERE "artistId" = ANY(${ids})
          GROUP BY "artistId"
        ),
        collab_counts AS (
          SELECT c1."artistId", COUNT(DISTINCT c2."artistId")::bigint AS cnt
          FROM "Credit" c1
          JOIN "Credit" c2 ON c2."recordingId" = c1."recordingId"
            AND c2."artistId" != c1."artistId"
          WHERE c1."artistId" = ANY(${ids})
          GROUP BY c1."artistId"
        ),
        sample_counts AS (
          SELECT c."artistId", COUNT(DISTINCT sr.id)::bigint AS cnt
          FROM "Credit" c
          JOIN "SampleRelation" sr ON sr."samplingTrackId" = c."recordingId"
          WHERE c."artistId" = ANY(${ids})
          GROUP BY c."artistId"
        ),
        instr_counts AS (
          SELECT "artistId", COUNT(DISTINCT instrument)::bigint AS cnt
          FROM "Credit"
          WHERE "artistId" = ANY(${ids})
            AND instrument IS NOT NULL
          GROUP BY "artistId"
        )
      SELECT
        a.mbid,
        COALESCE(tc.cnt, 0) AS genre_breadth,
        COALESCE(sc.cnt, 0) AS sample_use,
        COALESCE(cc.cnt, 0) AS collab_radius,
        COALESCE(ic.cnt, 0) AS instrument_diversity
      FROM "Artist" a
      LEFT JOIN tag_counts   tc ON tc."artistId" = a.id
      LEFT JOIN collab_counts cc ON cc."artistId" = a.id
      LEFT JOIN sample_counts sc ON sc."artistId" = a.id
      LEFT JOIN instr_counts  ic ON ic."artistId" = a.id
      WHERE a.id = ANY(${ids})
    `

    // Upsert profiles
    for (const p of profiles) {
      const toScore = (v: bigint, max: number) =>
        Math.min(100, (Number(v) / max) * 100)

      await prisma.soundProfile.upsert({
        where: { entityMbid: p.mbid },
        create: {
          entityType: 'artist',
          entityMbid: p.mbid,
          genreBreadth:        toScore(p.genre_breadth, GLOBAL_MAX.genreBreadth),
          sampleUse:           toScore(p.sample_use, GLOBAL_MAX.sampleUse),
          collaborationRadius: toScore(p.collab_radius, GLOBAL_MAX.collabRadius),
          eraSpread:           0, // ReleaseRecording not populated
          instrumentDiversity: toScore(p.instrument_diversity, GLOBAL_MAX.instrDiversity),
          geographicReach:     0, // ReleaseRecording not populated
        },
        update: {
          genreBreadth:        toScore(p.genre_breadth, GLOBAL_MAX.genreBreadth),
          sampleUse:           toScore(p.sample_use, GLOBAL_MAX.sampleUse),
          collaborationRadius: toScore(p.collab_radius, GLOBAL_MAX.collabRadius),
          instrumentDiversity: toScore(p.instrument_diversity, GLOBAL_MAX.instrDiversity),
        },
      })
    }

    processed += batch.length
    if (i % (BATCH * 5) === 0) {
      const pct = ((processed / artists.length) * 100).toFixed(1)
      console.log(`  ${processed} / ${artists.length} (${pct}%)`)
    }
  }

  const total = await prisma.soundProfile.count()
  console.log(`\nDone! Total SoundProfile rows: ${total}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
