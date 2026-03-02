/**
 * Classify ALL popular artists into Sound Families based on ArtistTag data.
 * Uses bulk INSERT ... SELECT for each family — much faster than looped upserts.
 *
 * Run: npx tsx scripts/seed-classify-all.ts
 * Safe to re-run (upserts, no duplicates).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SOUND_FAMILIES: Array<{ slug: string; tags: string[] }> = [
  {
    slug: 'hip-hop',
    tags: ['hip hop', 'hip-hop', 'rap', 'trap', 'boom bap', 'drill', 'grime', 'cloud rap',
           'mumble rap', 'conscious hip hop', 'gangsta rap', 'east coast hip hop',
           'west coast hip hop', 'southern hip hop', 'crunk', 'dirty south', 'chopped and screwed'],
  },
  {
    slug: 'rock',
    tags: ['rock', 'alternative rock', 'indie rock', 'punk', 'metal', 'hard rock', 'classic rock',
           'grunge', 'post-rock', 'psychedelic rock', 'folk rock', 'progressive rock', 'art rock',
           'heavy metal', 'punk rock', 'alternative', 'pop rock', 'emo', 'screamo', 'metalcore',
           'death metal', 'black metal', 'doom metal', 'post-punk', 'new wave', 'shoegaze'],
  },
  {
    slug: 'jazz',
    tags: ['jazz', 'bebop', 'cool jazz', 'free jazz', 'jazz fusion', 'soul jazz', 'swing',
           'bossa nova', 'modal jazz', 'hard bop', 'post-bop', 'big band', 'latin jazz',
           'acid jazz', 'smooth jazz', 'contemporary jazz', 'avant-garde jazz'],
  },
  {
    slug: 'electronic',
    tags: ['electronic', 'techno', 'house', 'ambient', 'drum and bass', 'edm', 'idm', 'dubstep',
           'trance', 'electro', 'synth-pop', 'industrial', 'electronica', 'dance', 'club',
           'deep house', 'progressive house', 'minimal techno', 'breakbeat', 'jungle',
           'garage', 'uk garage', 'future bass', 'lo-fi', 'chillwave', 'vaporwave',
           'electronic dance music', 'dance music'],
  },
  {
    slug: 'rnb-soul',
    tags: ['soul', 'rhythm and blues', 'r&b', 'neo soul', 'funk', 'motown', 'gospel',
           'quiet storm', 'new jack swing', 'contemporary r&b', 'urban contemporary',
           'disco', 'blue-eyed soul', 'southern soul', 'doo-wop', 'electro-soul'],
  },
  {
    slug: 'folk-country',
    tags: ['folk', 'country', 'bluegrass', 'americana', 'singer-songwriter', 'traditional folk',
           'alt-country', 'outlaw country', 'contemporary folk', 'celtic', 'folk rock',
           'country rock', 'honky tonk', 'western', 'appalachian', 'old-time'],
  },
]

async function main() {
  console.log('Fetching Sound Family IDs...')
  const families = await prisma.genreTaxonomy.findMany({ where: { level: 'family' } })
  const familyMap = new Map(families.map(f => [f.slug, f.id]))

  let totalNew = 0

  for (const fam of SOUND_FAMILIES) {
    const taxonomyId = familyMap.get(fam.slug)
    if (!taxonomyId) { console.log(`  Skipping ${fam.slug} — not found in DB`); continue }

    const normalizedTags = fam.tags.map(t => t.toLowerCase())

    // Bulk insert: all popular artists with matching tags, skip existing
    const result = await prisma.$executeRaw`
      INSERT INTO "SpecimenClassification" (id, "entityType", "entityMbid", "taxonomyId", confidence)
      SELECT
        gen_random_uuid()::text,
        'artist',
        a.mbid,
        ${taxonomyId},
        1.0
      FROM "Artist" a
      JOIN "ArtistTag" at ON at."artistId" = a.id
      WHERE LOWER(at.tag) = ANY(${normalizedTags})
        AND a.popularity > 0
      GROUP BY a.mbid
      ON CONFLICT ("entityType", "entityMbid", "taxonomyId") DO NOTHING
    `

    // Get actual count now
    const count = await prisma.specimenClassification.count({
      where: { taxonomyId, entityType: 'artist' },
    })

    await prisma.genreTaxonomy.update({
      where: { id: taxonomyId },
      data: { specimenCount: count },
    })

    console.log(`  ${fam.slug}: ${count.toLocaleString()} total artists (${result} new)`)
    totalNew += result
  }

  const totalClassifications = await prisma.specimenClassification.count()
  const uniqueArtists = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(DISTINCT "entityMbid") FROM "SpecimenClassification" WHERE "entityType" = 'artist'
  `

  console.log(`\nDone!`)
  console.log(`  New classifications added: ${totalNew.toLocaleString()}`)
  console.log(`  Total classifications: ${totalClassifications.toLocaleString()}`)
  console.log(`  Unique artists classified: ${Number(uniqueArtists[0].count).toLocaleString()}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
