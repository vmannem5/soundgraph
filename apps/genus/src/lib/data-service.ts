import { prisma } from '@soundgraph/database'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TaxonomyNode {
  id: string
  name: string
  slug: string
  level: string
  specimenCount: number
  description: string | null
  children: TaxonomyNode[]
}

export interface SpecimenSummary {
  mbid: string
  name: string
  country: string | null
  type: string | null
  imageUrl?: string | null
  primaryFamily: string | null
  primaryFamilySlug: string | null
  lineage: string[]
}

export interface SpecimenDetail extends SpecimenSummary {
  imageUrl: string | null
  tags: Array<{ tag: string; count: number }>
  soundProfile: {
    genreBreadth: number
    sampleUse: number
    collaborationRadius: number
    eraSpread: number
    instrumentDiversity: number
    geographicReach: number
  } | null
  classifications: Array<{
    taxonomyId: string
    name: string
    slug: string
    level: string
  }>
  relatedSpecimens: SpecimenSummary[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLineage(node: any): string[] {
  const path: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = node
  while (current) {
    path.unshift(current.name)
    current = current.parent ?? null
  }
  return path
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNode(n: any): TaxonomyNode {
  return {
    id: n.id,
    name: n.name,
    slug: n.slug,
    level: n.level,
    specimenCount: n.specimenCount,
    description: n.description,
    children: (n.children || []).map(mapNode),
  }
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getSoundFamilies(): Promise<TaxonomyNode[]> {
  const families = await prisma.genreTaxonomy.findMany({
    where: { level: 'family' },
    orderBy: { specimenCount: 'desc' },
    include: {
      children: {
        include: {
          children: {
            include: {
              children: {
                include: { children: true }
              }
            }
          }
        }
      }
    },
  }).catch(() => [])
  return families.map(mapNode)
}

export async function getTaxonomyNode(slug: string) {
  return prisma.genreTaxonomy.findUnique({
    where: { slug },
    include: {
      parent: { include: { parent: { include: { parent: true } } } },
      children: { orderBy: { specimenCount: 'desc' } },
    },
  }).catch(() => null)
}

export async function getSpecimenDetail(mbid: string): Promise<SpecimenDetail | null> {
  const artist = await prisma.artist.findUnique({
    where: { mbid },
    include: { tags: { orderBy: { count: 'desc' }, take: 10 } },
  }).catch(() => null)
  if (!artist) return null

  const [classifications, soundProfile, relatedRaw] = await Promise.all([
    prisma.specimenClassification.findMany({
      where: { entityMbid: mbid, entityType: 'artist' },
      include: {
        taxonomy: {
          include: {
            parent: { include: { parent: { include: { parent: true } } } },
          },
        },
      },
    }).catch(() => []),

    prisma.soundProfile.findUnique({ where: { entityMbid: mbid } }).catch(() => null),

    prisma.$queryRaw<Array<{ mbid: string; name: string; country: string | null; type: string | null }>>`
      SELECT DISTINCT a2.mbid, a2.name, a2.country, a2.type
      FROM "SpecimenClassification" sc1
      JOIN "SpecimenClassification" sc2 ON sc2."taxonomyId" = sc1."taxonomyId"
        AND sc2."entityMbid" != ${mbid}
        AND sc2."entityType" = 'artist'
      JOIN "Artist" a2 ON a2.mbid = sc2."entityMbid"
      WHERE sc1."entityMbid" = ${mbid}
        AND sc1."entityType" = 'artist'
      LIMIT 5
    `.catch(() => []),
  ])

  const LEVEL_ORDER: Record<string, number> = { family: 0, movement: 1, scene: 2, sound: 3, strain: 4 }
  const familyClassification = classifications.find(c => c.taxonomy.level === 'family')
  const primaryFamily = familyClassification?.taxonomy.name ?? null
  const primaryFamilySlug = familyClassification?.taxonomy.slug ?? null

  const deepest = [...classifications].sort((a, b) =>
    (LEVEL_ORDER[b.taxonomy.level] ?? 0) - (LEVEL_ORDER[a.taxonomy.level] ?? 0)
  )[0]
  const lineage = deepest ? buildLineage(deepest.taxonomy) : []

  // Look up each related artist's own primary family
  const relatedMbids = relatedRaw.map(r => r.mbid)
  const relFamilyMap = new Map<string, { name: string; slug: string }>()
  if (relatedMbids.length > 0) {
    const relFams = await prisma.$queryRaw<Array<{ entityMbid: string; name: string; slug: string }>>`
      SELECT sc."entityMbid", gt.name, gt.slug
      FROM "SpecimenClassification" sc
      JOIN "GenreTaxonomy" gt ON gt.id = sc."taxonomyId" AND gt.level = 'family'
      WHERE sc."entityMbid" = ANY(${relatedMbids})
        AND sc."entityType" = 'artist'
    `.catch(() => [])
    for (const f of relFams) relFamilyMap.set(f.entityMbid, { name: f.name, slug: f.slug })
  }

  const relatedSpecimens: SpecimenSummary[] = relatedRaw.map(r => ({
    mbid: r.mbid,
    name: r.name,
    country: r.country,
    type: r.type,
    primaryFamily: relFamilyMap.get(r.mbid)?.name ?? null,
    primaryFamilySlug: relFamilyMap.get(r.mbid)?.slug ?? null,
    lineage: [],  // not fetched for related specimens
  }))

  return {
    mbid: artist.mbid,
    name: artist.name,
    imageUrl: artist.imageUrl ?? null,
    country: artist.country ?? null,
    type: artist.type ?? null,
    primaryFamily,
    primaryFamilySlug,
    lineage,
    tags: artist.tags.map(t => ({ tag: t.tag, count: t.count })),
    soundProfile: soundProfile ? {
      genreBreadth: soundProfile.genreBreadth,
      sampleUse: soundProfile.sampleUse,
      collaborationRadius: soundProfile.collaborationRadius,
      eraSpread: soundProfile.eraSpread,
      instrumentDiversity: soundProfile.instrumentDiversity,
      geographicReach: soundProfile.geographicReach,
    } : null,
    classifications: classifications.map(c => ({
      taxonomyId: c.taxonomyId,
      name: c.taxonomy.name,
      slug: c.taxonomy.slug,
      level: c.taxonomy.level,
    })),
    relatedSpecimens,
  }
}

export async function getSpecimensForTaxonomy(taxonomyId: string): Promise<Array<{ mbid: string; name: string; country: string | null; imageUrl: string | null; influenceScore: number }>> {
  return prisma.$queryRaw<Array<{ mbid: string; name: string; country: string | null; imageUrl: string | null; influenceScore: number }>>`
    SELECT
      a.mbid, a.name, a.country, a."imageUrl",
      COALESCE(sp."sampleUse", 0) + COALESCE(sp."collaborationRadius", 0) AS "influenceScore"
    FROM "SpecimenClassification" sc
    JOIN "Artist" a ON a.mbid = sc."entityMbid"
    LEFT JOIN "SoundProfile" sp ON sp."entityMbid" = a.mbid
    WHERE sc."taxonomyId" = ${taxonomyId}
      AND sc."entityType" = 'artist'
    ORDER BY "influenceScore" DESC, a.popularity DESC NULLS LAST
    LIMIT 24
  `.catch(() => [])
}

export async function searchSpecimens(query: string): Promise<SpecimenSummary[]> {
  if (!query.trim()) return []

  const pattern = `%${query.trim()}%`
  const artists = await prisma.$queryRaw<Array<{ mbid: string; name: string; country: string | null; type: string | null; imageUrl: string | null }>>`
    SELECT a.mbid, a.name, a.country, a.type, a."imageUrl"
    FROM "Artist" a
    WHERE a.name ILIKE ${pattern}
    ORDER BY a.popularity DESC NULLS LAST
    LIMIT 12
  `.catch(() => [])

  const mbids = artists.map(a => a.mbid)
  const familyMap = new Map<string, { name: string; slug: string }>()
  if (mbids.length > 0) {
    const fams = await prisma.$queryRaw<Array<{ entityMbid: string; name: string; slug: string }>>`
      SELECT sc."entityMbid", gt.name, gt.slug
      FROM "SpecimenClassification" sc
      JOIN "GenreTaxonomy" gt ON gt.id = sc."taxonomyId" AND gt.level = 'family'
      WHERE sc."entityMbid" = ANY(${mbids})
        AND sc."entityType" = 'artist'
    `.catch(() => [])
    for (const f of fams) familyMap.set(f.entityMbid, { name: f.name, slug: f.slug })
  }

  return artists.map(a => ({
    mbid: a.mbid,
    name: a.name,
    country: a.country,
    type: a.type,
    imageUrl: a.imageUrl ?? null,
    primaryFamily: familyMap.get(a.mbid)?.name ?? null,
    primaryFamilySlug: familyMap.get(a.mbid)?.slug ?? null,
    lineage: familyMap.get(a.mbid) ? [familyMap.get(a.mbid)!.name] : [],
  }))
}

export async function getFeaturedSpecimens(): Promise<SpecimenSummary[]> {
  const rows = await prisma.$queryRaw<Array<{
    famId: string
    mbid: string
    name: string
    country: string | null
    type: string | null
    imageUrl: string | null
    famName: string
    famSlug: string
  }>>`
    SELECT DISTINCT ON (sc."taxonomyId")
      sc."taxonomyId" AS "famId",
      a.mbid, a.name, a.country, a.type, a."imageUrl",
      gt.name AS "famName", gt.slug AS "famSlug"
    FROM "SpecimenClassification" sc
    JOIN "Artist" a ON a.mbid = sc."entityMbid"
    JOIN "GenreTaxonomy" gt ON gt.id = sc."taxonomyId" AND gt.level = 'family'
    WHERE sc."entityType" = 'artist'
    ORDER BY sc."taxonomyId", a.popularity DESC NULLS LAST
  `.catch(() => [])

  return rows.map(r => ({
    mbid: r.mbid,
    name: r.name,
    country: r.country,
    type: r.type,
    imageUrl: r.imageUrl ?? null,
    primaryFamily: r.famName,
    primaryFamilySlug: r.famSlug,
    lineage: [r.famName],
  }))
}

/** Returns top N artists per Sound Family — used for homepage family row previews */
export async function getArtistsPerFamily(perFamily = 5): Promise<Map<string, SpecimenSummary[]>> {
  const n = Math.max(1, Math.min(20, Math.floor(perFamily)))
  const rows = await prisma.$queryRaw<Array<{
    famSlug: string
    mbid: string
    name: string
    imageUrl: string | null
    rn: bigint
  }>>`
    SELECT famSlug, mbid, name, "imageUrl", rn FROM (
      SELECT
        gt.slug AS "famSlug",
        a.mbid, a.name, a."imageUrl",
        ROW_NUMBER() OVER (PARTITION BY gt.id ORDER BY a.popularity DESC NULLS LAST) AS rn
      FROM "SpecimenClassification" sc
      JOIN "Artist" a ON a.mbid = sc."entityMbid"
      JOIN "GenreTaxonomy" gt ON gt.id = sc."taxonomyId" AND gt.level = 'family'
      WHERE sc."entityType" = 'artist'
        AND a."imageUrl" IS NOT NULL
    ) sub
    WHERE rn <= ${n}
    ORDER BY "famSlug", rn
  `.catch(() => [])

  const map = new Map<string, SpecimenSummary[]>()
  for (const r of rows) {
    if (!map.has(r.famSlug)) map.set(r.famSlug, [])
    map.get(r.famSlug)!.push({
      mbid: r.mbid, name: r.name, country: null, type: null,
      imageUrl: r.imageUrl, primaryFamily: null, primaryFamilySlug: r.famSlug, lineage: [],
    })
  }
  return map
}

// ── Hybrid data (SoundGraph artist connections) ────────────────────────────

export interface HybridData {
  collaborators: Array<{ mbid: string; name: string; count: number }>
  samplesFrom: Array<{ mbid: string; title: string; artistName: string | null }>
  sampledBy: Array<{ mbid: string; title: string; artistName: string | null }>
}

export async function getArtistHybridData(artistMbid: string): Promise<HybridData> {
  const [collaborators, samplesFrom, sampledBy] = await Promise.all([
    // Top collaborators by shared recording credit count
    prisma.$queryRaw<Array<{ mbid: string; name: string; count: bigint }>>`
      SELECT a2.mbid, a2.name, COUNT(*)::bigint AS count
      FROM "Artist" a
      JOIN "Credit" c1 ON c1."artistId" = a.id
      JOIN "Credit" c2 ON c2."recordingId" = c1."recordingId" AND c2."artistId" != a.id
      JOIN "Artist" a2 ON a2.id = c2."artistId"
      WHERE a.mbid = ${artistMbid}
      GROUP BY a2.mbid, a2.name
      ORDER BY count DESC
      LIMIT 8
    `.catch(() => []),

    // Tracks this artist's recordings sample
    prisma.$queryRaw<Array<{ mbid: string; title: string; artistName: string | null }>>`
      SELECT DISTINCT r2.mbid, r2.title, a2.name AS "artistName"
      FROM "Artist" a
      JOIN "Credit" c ON c."artistId" = a.id
      JOIN "Recording" r ON r.id = c."recordingId"
      JOIN "SampleRelation" sr ON sr."samplingTrackId" = r.id
      JOIN "Recording" r2 ON r2.id = sr."sampledTrackId"
      LEFT JOIN "Credit" c2 ON c2."recordingId" = r2.id
      LEFT JOIN "Artist" a2 ON a2.id = c2."artistId"
      WHERE a.mbid = ${artistMbid}
      LIMIT 6
    `.catch(() => []),

    // Tracks that sample this artist's recordings
    prisma.$queryRaw<Array<{ mbid: string; title: string; artistName: string | null }>>`
      SELECT DISTINCT r2.mbid, r2.title, a2.name AS "artistName"
      FROM "Artist" a
      JOIN "Credit" c ON c."artistId" = a.id
      JOIN "Recording" r ON r.id = c."recordingId"
      JOIN "SampleRelation" sr ON sr."sampledTrackId" = r.id
      JOIN "Recording" r2 ON r2.id = sr."samplingTrackId"
      LEFT JOIN "Credit" c2 ON c2."recordingId" = r2.id
      LEFT JOIN "Artist" a2 ON a2.id = c2."artistId"
      WHERE a.mbid = ${artistMbid}
      LIMIT 6
    `.catch(() => []),
  ])

  return {
    collaborators: collaborators.map(c => ({ mbid: c.mbid, name: c.name, count: Number(c.count) })),
    samplesFrom,
    sampledBy,
  }
}
