/**
 * Seed GENUS taxonomy from existing ArtistTag data.
 *
 * What this does:
 * 1. Creates 6 Sound Families (top-level taxonomy nodes)
 * 2. Maps existing ArtistTag entries to Sound Families by tag name
 * 3. Inserts SpecimenClassification rows linking Artist.mbid → taxonomy node
 * 4. Computes SoundProfile for each classified artist
 *
 * Run: npx tsx scripts/seed-genus.ts
 * (from monorepo root)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Top 6 Sound Families + tag keywords that map to each
const SOUND_FAMILIES: Array<{
  name: string
  slug: string
  description: string
  tags: string[]  // if an artist has ANY of these tags, they belong here
}> = [
  {
    name: 'Hip-Hop',
    slug: 'hip-hop',
    description: 'Rhythmic vocal delivery over sampled or programmed beats',
    tags: ['hip hop', 'hip-hop', 'rap', 'trap', 'boom bap', 'drill', 'r&b', 'grime', 'cloud rap', 'mumble rap', 'conscious hip hop'],
  },
  {
    name: 'Rock',
    slug: 'rock',
    description: 'Guitar-driven music spanning blues, punk, metal, and indie',
    tags: ['rock', 'alternative rock', 'indie rock', 'punk', 'metal', 'hard rock', 'classic rock', 'grunge', 'post-rock', 'psychedelic rock', 'folk rock'],
  },
  {
    name: 'Jazz',
    slug: 'jazz',
    description: 'Improvisation-centered music with complex harmony',
    tags: ['jazz', 'bebop', 'cool jazz', 'free jazz', 'jazz fusion', 'soul jazz', 'swing', 'bossa nova', 'modal jazz'],
  },
  {
    name: 'Electronic',
    slug: 'electronic',
    description: 'Synthesizer and computer-generated sound design',
    tags: ['electronic', 'techno', 'house', 'ambient', 'drum and bass', 'edm', 'idm', 'dubstep', 'trance', 'electro', 'synth-pop', 'industrial'],
  },
  {
    name: 'R&B & Soul',
    slug: 'rnb-soul',
    description: 'Melody-driven Black American music rooted in gospel and blues',
    tags: ['soul', 'rhythm and blues', 'neo soul', 'funk', 'motown', 'gospel', 'quiet storm', 'new jack swing'],
  },
  {
    name: 'Folk & Country',
    slug: 'folk-country',
    description: 'Acoustic and storytelling traditions from rural American roots',
    tags: ['folk', 'country', 'bluegrass', 'americana', 'singer-songwriter', 'traditional folk', 'alt-country'],
  },
]

async function main() {
  console.log('Seeding GENUS taxonomy...')

  // 1. Upsert Sound Families
  const familyMap = new Map<string, string>() // slug → id (String cuid)
  for (const fam of SOUND_FAMILIES) {
    const node = await prisma.genreTaxonomy.upsert({
      where: { slug: fam.slug },
      create: {
        name: fam.name,
        slug: fam.slug,
        level: 'family',
        description: fam.description,
      },
      update: {
        name: fam.name,
        description: fam.description,
      },
    })
    familyMap.set(fam.slug, node.id)
    console.log(`  Upserted Sound Family: ${fam.name} (id=${node.id})`)
  }

  // 2. For each Sound Family, find artists with matching tags and classify them
  let totalClassified = 0
  for (const fam of SOUND_FAMILIES) {
    const taxonomyId = familyMap.get(fam.slug)!

    // Find all artist mbids that have at least one matching tag
    const normalizedTags = fam.tags.map(t => t.toLowerCase())
    const artists = await prisma.$queryRaw<Array<{ mbid: string }>>`
      SELECT DISTINCT a.mbid
      FROM "Artist" a
      JOIN "ArtistTag" at ON at."artistId" = a.id
      WHERE LOWER(at.tag) = ANY(${normalizedTags})
      LIMIT 500 -- MVP: seed top 500 artists per family; re-run to reclassify
    `

    let classifiedInFamily = 0
    for (const artist of artists) {
      await prisma.specimenClassification.upsert({
        where: {
          entityType_entityMbid_taxonomyId: {
            entityType: 'artist',
            entityMbid: artist.mbid,
            taxonomyId,
          },
        },
        create: {
          entityType: 'artist',
          entityMbid: artist.mbid,
          taxonomyId,
          confidence: 1.0,
        },
        update: {},
      })
      classifiedInFamily++
    }

    // Update specimenCount on the taxonomy node using actual DB count
    // (avoids drift if upserts skipped existing rows or rows were deleted)
    const actualCount = await prisma.specimenClassification.count({
      where: { taxonomyId, entityType: 'artist' },
    })
    await prisma.genreTaxonomy.update({
      where: { id: taxonomyId },
      data: { specimenCount: actualCount },
    })

    totalClassified += classifiedInFamily
    console.log(`  ${fam.name}: classified ${classifiedInFamily} artists`)
  }

  console.log(`\nTotal artist classifications: ${totalClassified}`)

  // 3. Compute SoundProfile for all classified artists
  console.log('\nComputing Sound Profiles...')

  // Get all unique artist mbids that were classified
  const classifiedArtists = await prisma.specimenClassification.findMany({
    where: { entityType: 'artist' },
    select: { entityMbid: true },
    distinct: ['entityMbid'],
  })

  console.log(`  Computing profiles for ${classifiedArtists.length} artists...`)

  // Global maxima for normalization - set higher to avoid excessive capping
  const globalMax = {
    genreBreadth:   50,
    sampleUse:      100,  // increased from 20
    collabRadius:   500,  // increased from 200
    eraSpread:      50,
    instrDiversity: 10,   // use role types instead
    geoReach:       30,
  }
  console.log('  Global maxima:', globalMax)

  // Compute in batches of 100 to avoid memory issues
  const BATCH = 100
  for (let i = 0; i < classifiedArtists.length; i += BATCH) {
    const batch = classifiedArtists.slice(i, i + BATCH)
    const mbids = batch.map(a => a.entityMbid)

    // Raw query to compute all 6 axes at once
    // Count both incoming and outgoing samples, use role types for diversity
    const profiles = await prisma.$queryRaw<Array<{
      mbid: string
      genre_breadth: bigint
      sample_use: bigint
      collab_radius: bigint
      era_spread: number | null
      role_diversity: bigint
      geo_reach: bigint
    }>>`
      SELECT
        a.mbid,
        COUNT(DISTINCT at.tag)                         AS genre_breadth,
        (SELECT COUNT(*) FROM "SampleRelation" sr2 
         JOIN "Credit" c3 ON c3."recordingId" = sr2."samplingTrackId" 
         JOIN "Artist" a3 ON a3.id = c3."artistId" WHERE a3.mbid = a.mbid
         UNION ALL
         SELECT COUNT(*) FROM "SampleRelation" sr2 
         JOIN "Credit" c3 ON c3."recordingId" = sr2."sampledTrackId" 
         JOIN "Artist" a3 ON a3.id = c3."artistId" WHERE a3.mbid = a.mbid
        )                                               AS sample_use,
        COUNT(DISTINCT c."artistId")                   AS collab_radius,
        0                                               AS era_spread,
        COUNT(DISTINCT c.role)                          AS role_diversity,
        COUNT(DISTINCT c.role)                          AS geo_reach
      FROM "Artist" a
      LEFT JOIN "ArtistTag" at ON at."artistId" = a.id
      LEFT JOIN "Credit" c2 ON c2."artistId" = a.id
      LEFT JOIN "Recording" rec ON rec.id = c2."recordingId"
      LEFT JOIN "SampleRelation" sr ON sr."samplingTrackId" = rec.id
      LEFT JOIN "Credit" c ON c."recordingId" = rec.id AND c."artistId" != a.id
      WHERE a.mbid = ANY(${mbids})
      GROUP BY a.mbid
    `

    for (let j = 0; j < profiles.length; j++) {
      const p = profiles[j]
      // For eraSpread and geoReach, compute synthetic scores from available data
      // eraSpread: based on collaboration radius as proxy for career span
      // geoReach: based on sample usage as proxy for international influence
      const eraScore = Number(p.collab_radius) > 100 ? 80 : Number(p.collab_radius) * 0.8
      const geoScore = Number(p.sample_use) > 20 ? 60 : Number(p.sample_use) * 3

      const toN = (v: bigint | number | null, max: number) =>
        Math.min(100, (Number(v ?? 0) / max) * 100)

      await prisma.soundProfile.upsert({
        where: { entityMbid: p.mbid },
        create: {
          entityType: 'artist',
          entityMbid: p.mbid,
          genreBreadth:        toN(p.genre_breadth, globalMax.genreBreadth),
          sampleUse:           toN(p.sample_use, globalMax.sampleUse),
          collaborationRadius: toN(p.collab_radius, globalMax.collabRadius),
          eraSpread:           Math.min(100, eraScore),
          instrumentDiversity: toN(p.role_diversity, globalMax.instrDiversity),
          geographicReach:     Math.min(100, geoScore),
        },
        update: {
          genreBreadth:        toN(p.genre_breadth, globalMax.genreBreadth),
          sampleUse:           toN(p.sample_use, globalMax.sampleUse),
          collaborationRadius: toN(p.collab_radius, globalMax.collabRadius),
          eraSpread:           Math.min(100, eraScore),
          instrumentDiversity: toN(p.role_diversity, globalMax.instrDiversity),
          geographicReach:     Math.min(100, geoScore),
        },
      })
    }

    if (i % (BATCH * 5) === 0 && i > 0) {
      console.log(`  Progress: ${i} / ${classifiedArtists.length}`)
    }
  }

  console.log('\nDone! Summary:')
  const familyCount = await prisma.genreTaxonomy.count({ where: { level: 'family' } })
  const classCount = await prisma.specimenClassification.count()
  const profileCount = await prisma.soundProfile.count()
  console.log(`  GenreTaxonomy (family) rows: ${familyCount}`)
  console.log(`  SpecimenClassification rows: ${classCount}`)
  console.log(`  SoundProfile rows: ${profileCount}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
