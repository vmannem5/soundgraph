# Advanced Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add genre bubbles, genre heatmap, sample chain ancestry, and go-live infrastructure (security headers + nginx/HTTPS + DB deploy) in four parallel tracks.

**Architecture:** Genre bubbles extend the existing `ConnectionBubbles` SVG component with a new category. The genre heatmap and sample chain are new server components wired into existing detail pages. Go-live infrastructure touches `next.config.ts`, the Hetzner server, and DNS — no app-level regressions.

**Tech Stack:** Next.js 15 App Router, Prisma 5.22.0, PostgreSQL 16, d3-hierarchy (already installed), plain CSS grid for heatmap, no new npm packages.

---

## Track A — Genre Bubbles

### Task A1: Add GENRES category to ConnectionBubbles

**Files:**
- Modify: `apps/web/src/components/connection-bubbles.tsx`

**Context:** The file has a `CAT` const at line 38 and a `CAT_ORDER` array at line 45. `getCatKey` maps connection type strings to category keys. `Connection.targetType` is currently `'artist' | 'recording'` — we need to add `'tag'`.

**Step 1: Update the `Connection` interface to allow `targetType: 'tag'`**

Find (line 9):
```typescript
export interface Connection {
  type: string
  label: string
  targetType: string
  targetId: string
  targetName: string
  importance?: number
  attributes?: string[]
}
```
Change `targetType: string` to `targetType: 'artist' | 'recording' | 'tag'`

**Step 2: Add GENRES to CAT**

Find:
```typescript
const CAT = {
  SAMPLES_FROM: { label: 'Samples From', color: '#e8974a', bg: 'rgba(232,151,74,0.22)'  },
  SAMPLED_BY:   { label: 'Sampled By',   color: '#6b9ae8', bg: 'rgba(107,154,232,0.22)' },
  CREDITS:      { label: 'Credits',      color: '#7cc4a8', bg: 'rgba(124,196,168,0.18)' },
  PERFORMERS:   { label: 'Performers',   color: '#b87dc4', bg: 'rgba(184,125,196,0.18)' },
} as const

const CAT_ORDER = ['SAMPLES_FROM', 'SAMPLED_BY', 'CREDITS', 'PERFORMERS'] as const
type CatKey = typeof CAT_ORDER[number]
```
Replace with:
```typescript
const CAT = {
  SAMPLES_FROM: { label: 'Samples From', color: '#e8974a', bg: 'rgba(232,151,74,0.22)'  },
  SAMPLED_BY:   { label: 'Sampled By',   color: '#6b9ae8', bg: 'rgba(107,154,232,0.22)' },
  CREDITS:      { label: 'Credits',      color: '#7cc4a8', bg: 'rgba(124,196,168,0.18)' },
  PERFORMERS:   { label: 'Performers',   color: '#b87dc4', bg: 'rgba(184,125,196,0.18)' },
  GENRES:       { label: 'Genres',       color: '#f0d060', bg: 'rgba(240,208,96,0.18)'  },
} as const

const CAT_ORDER = ['SAMPLES_FROM', 'SAMPLED_BY', 'GENRES', 'CREDITS', 'PERFORMERS'] as const
type CatKey = typeof CAT_ORDER[number]
```

**Step 3: Add GENRES branch to getCatKey**

Find:
```typescript
function getCatKey(type: string): CatKey {
  const t = type.toLowerCase()
  if (t.includes('sample') && !t.includes('by')) return 'SAMPLES_FROM'
  if (t === 'sampled by' || t.includes('sampled by')) return 'SAMPLED_BY'
  if (t === 'performer' || t.includes('vocal') || t.includes('instrument')) return 'PERFORMERS'
  return 'CREDITS'
}
```
Replace with:
```typescript
function getCatKey(type: string): CatKey {
  const t = type.toLowerCase()
  if (t === 'genre') return 'GENRES'
  if (t.includes('sample') && !t.includes('by')) return 'SAMPLES_FROM'
  if (t === 'sampled by' || t.includes('sampled by')) return 'SAMPLED_BY'
  if (t === 'performer' || t.includes('vocal') || t.includes('instrument')) return 'PERFORMERS'
  return 'CREDITS'
}
```

**Step 4: Handle tag leaf clicks**

In the expanded leaves `onClick` handler, find:
```typescript
onClick={(e) => {
  e.stopPropagation()
  if (ld.targetType === 'artist') router.push(`/artist/${ld.targetId}`)
  else if (ld.targetType === 'recording') router.push(`/recording/${ld.targetId}`)
}}
```
Replace with:
```typescript
onClick={(e) => {
  e.stopPropagation()
  if (ld.targetType === 'artist') router.push(`/artist/${ld.targetId}`)
  else if (ld.targetType === 'recording') router.push(`/recording/${ld.targetId}`)
  else if (ld.targetType === 'tag') router.push(`/?q=${encodeURIComponent(ld.targetName)}`)
}}
```

**Step 5: Verify build**
```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -10
```
Expected: no TypeScript errors, routes listed.

**Step 6: Commit**
```bash
git add apps/web/src/components/connection-bubbles.tsx
git commit -m "feat: add Genres category to ConnectionBubbles"
```

---

### Task A2: Wire genre tags into artist page ConnectionBubbles

**Files:**
- Modify: `apps/web/src/app/artist/[mbid]/page.tsx`

**Context:** The artist page already has `allGenres` (array of strings combining Spotify genres + MusicBrainz tags). It also has `artist.tags` (array of `{ name: string, count: number }`). The `ConnectionBubbles` component at the bottom of the page currently receives only collaborators/producers/samples connections.

**Step 1: Build the genres connection array and add it to ConnectionBubbles**

Find the `<ConnectionBubbles connections={[` block. It ends with `...sampledBy.slice(0, 4).map(...)`. Add genres after that:

```tsx
// Before the closing ]} of the connections prop, add:
...allGenres.slice(0, 12).map((g) => {
  // Find count from artist.tags if available, else default to 1
  const tagEntry = artist.tags?.find((t: { name: string; count: number }) => t.name === g)
  return {
    type: 'genre' as const,
    label: g,
    targetType: 'tag' as const,
    targetId: g,
    targetName: g,
    importance: tagEntry?.count || 1,
  }
}),
```

The full updated connections prop should look like:
```tsx
connections={[
  ...topCollaborators.slice(0, 8).map((a) => ({
    type: 'performer',
    label: `${a.count} collabs`,
    targetType: 'artist' as const,
    targetId: a.mbid,
    targetName: a.name,
    importance: a.count,
  })),
  ...topProducers.slice(0, 6).map((a) => ({
    type: 'producer',
    label: `${a.count} productions`,
    targetType: 'artist' as const,
    targetId: a.mbid,
    targetName: a.name,
    importance: a.count,
  })),
  ...samplesFrom.slice(0, 4).map((s) => ({
    type: 'samples material',
    label: 'samples',
    targetType: 'recording' as const,
    targetId: s.rec_mbid,
    targetName: s.artist_name ? `${s.rec_title} (${s.artist_name})` : s.rec_title,
    importance: s.popularity || 1,
  })),
  ...sampledBy.slice(0, 4).map((s) => ({
    type: 'sampled by',
    label: 'sampled by',
    targetType: 'recording' as const,
    targetId: s.rec_mbid,
    targetName: s.artist_name ? `${s.rec_title} (${s.artist_name})` : s.rec_title,
    importance: s.popularity || 1,
  })),
  ...allGenres.slice(0, 12).map((g) => {
    const tagEntry = artist.tags?.find((t: { name: string; count: number }) => t.name === g)
    return {
      type: 'genre' as const,
      label: g,
      targetType: 'tag' as const,
      targetId: g,
      targetName: g,
      importance: tagEntry?.count || 1,
    }
  }),
]}
```

**Step 2: Verify build**
```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -10
```

**Step 3: Verify visually**
```bash
pnpm dev
```
Open `http://localhost:3000/artist/<any-mbid-with-tags>` (e.g. Drake). Expand the Connections section. You should see a golden "Genres" circle alongside the other categories.

**Step 4: Commit**
```bash
git add apps/web/src/app/artist/[mbid]/page.tsx
git commit -m "feat: add genre tags to artist ConnectionBubbles"
```

---

### Task A3: Wire recording tags into recording page ConnectionBubbles

**Files:**
- Modify: `apps/web/src/lib/data-service.ts`
- Modify: `apps/web/src/app/recording/[mbid]/page.tsx`

**Context:** `getRecordingConnections(mbid)` returns `{ recording, connections }`. The `connections` array currently has artists (performers, credits) and recordings (samples). We need to add recording tags.

**Step 1: Add tags to getRecordingConnections return**

In `data-service.ts`, find the `getRecordingConnections` function. It currently fetches a recording with Prisma includes. Find where it builds the `connections` array and add tag connections after the existing pushes.

Find the `return { recording, connections }` at the end of `getRecordingConnections`. Before that line, add:

```typescript
// Add RecordingTag entries as genre connections
const tagConnections: Connection[] = (recording.tags || [])
  .slice(0, 10)
  .map((rt: { tag: string; count: number }) => ({
    type: 'genre',
    label: rt.tag,
    targetType: 'tag' as const,
    targetId: rt.tag,
    targetName: rt.tag,
    importance: rt.count,
  }))
connections.push(...tagConnections)
```

Note: you need to check what the tags field is called in the Prisma recording include. Look for `tags` or `RecordingTag` in the include block. If it's not already included, add it:
```typescript
tags: { orderBy: { count: 'desc' }, take: 10 }
```
to the Prisma `findUnique` include block.

**Step 2: Verify build**
```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -10
```

**Step 3: Verify visually**
Open a recording page. Connections section should show Genres bubble when the recording has tags.

**Step 4: Commit**
```bash
git add apps/web/src/lib/data-service.ts apps/web/src/app/recording/[mbid]/page.tsx
git commit -m "feat: add recording tags to recording ConnectionBubbles"
```

---

## Track B — Genre Heatmap

### Task B1: Add getArtistGenreTimeline to data-service

**Files:**
- Modify: `apps/web/src/lib/data-service.ts` (append at end of file)

**Context:** The function needs to return per-year, per-genre counts by joining Artist → Credit → ReleaseRecording → Release → ReleaseGroup → ReleaseGroupTag. This requires `ReleaseRecording` to have rows (works on local; on Hetzner after DB deploy). The function must gracefully return `[]` on any error.

**Step 1: Append the new export at the bottom of data-service.ts**

```typescript
export interface GenreYearEntry {
  year: number
  tag: string
  total_count: number
}

export async function getArtistGenreTimeline(mbid: string): Promise<GenreYearEntry[]> {
  try {
    const rows = await prisma.$queryRaw<GenreYearEntry[]>`
      SELECT
        EXTRACT(YEAR FROM rg."firstReleaseDate"::date)::int AS year,
        rgt.tag,
        SUM(rgt.count)::int AS total_count
      FROM "Artist" a
      JOIN "Credit" c ON c."artistId" = a.id
      JOIN "ReleaseRecording" rr ON rr."recordingId" = c."recordingId"
      JOIN "Release" rel ON rel.id = rr."releaseId"
      JOIN "ReleaseGroup" rg ON rg.id = rel."releaseGroupId"
      JOIN "ReleaseGroupTag" rgt ON rgt."releaseGroupId" = rg.id
      WHERE a.mbid = ${mbid}
        AND rg."firstReleaseDate" IS NOT NULL
        AND rg."firstReleaseDate" != ''
        AND rg."firstReleaseDate" ~ '^[0-9]{4}'
      GROUP BY year, rgt.tag
      HAVING SUM(rgt.count) > 0
      ORDER BY year, total_count DESC
    `
    return rows
  } catch {
    return []
  }
}
```

**Step 2: Verify build**
```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -10
```

**Step 3: Commit**
```bash
git add apps/web/src/lib/data-service.ts
git commit -m "feat: add getArtistGenreTimeline query"
```

---

### Task B2: Create GenreHeatmap component

**Files:**
- Create: `apps/web/src/components/genre-heatmap.tsx`

**Context:** This is a pure server component — no `'use client'`. It receives `GenreYearEntry[]` and renders a CSS grid. Columns = 2-year era buckets, rows = top 8 genres by total count. Cell opacity scales linearly from 0.08 (min nonzero) to 0.85 (max). Cell color uses a deterministic hue from the genre name.

**Step 1: Create the file**

```typescript
import type { GenreYearEntry } from '@/lib/data-service'

interface Props {
  data: GenreYearEntry[]
}

// Deterministic hue 0-359 from a string
function genreHue(tag: string): number {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff
  return h % 360
}

export function GenreHeatmap({ data }: Props) {
  if (!data.length) return null

  // Pick top 8 genres by total count across all years
  const genreTotals = new Map<string, number>()
  for (const row of data) {
    genreTotals.set(row.tag, (genreTotals.get(row.tag) || 0) + row.total_count)
  }
  const topGenres = [...genreTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag)

  if (!topGenres.length) return null

  // Group years into 2-year buckets, sorted ascending
  const allYears = [...new Set(data.map(r => r.year))].sort()
  const minYear = allYears[0]
  const maxYear = allYears[allYears.length - 1]
  // Era labels: every 2 years from minYear to maxYear
  const eras: number[] = []
  for (let y = minYear; y <= maxYear; y += 2) eras.push(y)

  // Build lookup: tag → era → count
  const lookup = new Map<string, Map<number, number>>()
  for (const row of data) {
    const era = row.year % 2 === 0 ? row.year : row.year - 1
    if (!lookup.has(row.tag)) lookup.set(row.tag, new Map())
    const tagMap = lookup.get(row.tag)!
    tagMap.set(era, (tagMap.get(era) || 0) + row.total_count)
  }

  // Global max for opacity normalization
  let globalMax = 1
  for (const tagMap of lookup.values()) {
    for (const count of tagMap.values()) {
      if (count > globalMax) globalMax = count
    }
  }

  const opacity = (count: number) =>
    count === 0 ? 0 : 0.08 + (count / globalMax) * 0.77

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">Sound Evolution</h2>
      <div className="w-full overflow-x-auto">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `120px repeat(${eras.length}, minmax(36px, 1fr))`,
            gap: '2px',
            minWidth: `${120 + eras.length * 38}px`,
          }}
        >
          {/* Header row: empty cell + era labels */}
          <div />
          {eras.map(era => (
            <div
              key={era}
              className="text-center text-[10px] text-muted-foreground pb-1 font-medium"
            >
              {era}
            </div>
          ))}

          {/* Genre rows */}
          {topGenres.map(tag => {
            const hue = genreHue(tag)
            const color = `oklch(72% 0.18 ${hue})`
            return (
              <>
                {/* Genre label */}
                <div
                  key={`label-${tag}`}
                  className="text-xs font-medium truncate pr-2 flex items-center"
                  style={{ color }}
                >
                  {tag}
                </div>

                {/* Era cells */}
                {eras.map(era => {
                  const count = lookup.get(tag)?.get(era) || 0
                  return (
                    <div
                      key={`${tag}-${era}`}
                      title={count > 0 ? `${tag} · ${era}–${era + 1}: ${count} release${count !== 1 ? 's' : ''}` : undefined}
                      style={{
                        height: 28,
                        borderRadius: 4,
                        background: count > 0
                          ? `oklch(65% 0.20 ${hue} / ${opacity(count).toFixed(2)})`
                          : 'rgba(255,255,255,0.03)',
                        border: `1px solid oklch(65% 0.12 ${hue} / ${count > 0 ? 0.3 : 0.06})`,
                      }}
                    />
                  )
                })}
              </>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

**Step 2: Verify build**
```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -10
```
Expected: no errors.

**Step 3: Commit**
```bash
git add apps/web/src/components/genre-heatmap.tsx
git commit -m "feat: add GenreHeatmap component"
```

---

### Task B3: Wire GenreHeatmap into artist page

**Files:**
- Modify: `apps/web/src/app/artist/[mbid]/page.tsx`

**Step 1: Import the new function and component**

Add at the top of the file alongside existing imports:
```typescript
import { getArtistGenreTimeline } from '@/lib/data-service'
import { GenreHeatmap } from '@/components/genre-heatmap'
```

**Step 2: Add the fetch to the parallel Promise.all**

The current `Promise.all` is:
```typescript
const [artistResult, connectionsData, releaseGroupsResult] = await Promise.all([
  getArtistDetails(mbid).catch((e: unknown) => e),
  getArtistConnections(mbid),
  (async () => { ... })(),
])
```

Change to:
```typescript
const [artistResult, connectionsData, releaseGroupsResult, genreTimeline] = await Promise.all([
  getArtistDetails(mbid).catch((e: unknown) => e),
  getArtistConnections(mbid),
  (async () => { ... })(),
  getArtistGenreTimeline(mbid),
])
```

**Step 3: Render the heatmap on the page**

Find the `{/* Discography grid */}` section. Add the GenreHeatmap between discography and connections:

```tsx
{/* Sound Evolution heatmap */}
{genreTimeline.length > 0 && (
  <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4">
    <GenreHeatmap data={genreTimeline} />
  </div>
)}
```

Place this block right after the closing `</div>` of the Discography section and before the Connections section.

**Step 4: Verify build**
```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -10
```

**Step 5: Verify visually**
```bash
pnpm dev
```
Open an artist with release history. "Sound Evolution" heatmap should appear between discography and connections. (Will be empty until DB deploy on Hetzner since ReleaseRecording is 0 rows on that server.)

**Step 6: Commit**
```bash
git add apps/web/src/app/artist/[mbid]/page.tsx
git commit -m "feat: wire GenreHeatmap onto artist page"
```

---

## Track C — Sample Chain Ancestry

### Task C1: Add getRecordingSampleChain to data-service

**Files:**
- Modify: `apps/web/src/lib/data-service.ts` (append)

**Context:** Traverse `SampleRelation` up to 3 levels deep. Level 0 = current recording. Level 1 = what it directly samples. Level 2 = what level-1 tracks sample. Use 3 sequential Prisma queries (not recursive SQL) to keep it simple.

**Step 1: Define the types and append the function**

```typescript
export interface SampleNode {
  mbid: string
  title: string
  artistName: string | null
  year: string | null
  children: SampleNode[]
}

export async function getRecordingSampleChain(mbid: string): Promise<SampleNode[]> {
  try {
    // Level 1: direct samples of this recording
    const level1 = await prisma.sampleRelation.findMany({
      where: { samplingTrack: { mbid } },
      include: {
        sampledTrack: {
          include: {
            credits: {
              where: { role: 'performer' },
              take: 1,
              include: { artist: { select: { name: true } } },
            },
            releases: {
              take: 1,
              include: {
                release: {
                  include: {
                    releaseGroup: { select: { firstReleaseDate: true } },
                  },
                },
              },
            },
          },
        },
      },
      take: 5,
    })

    if (!level1.length) return []

    // Level 2: what each level-1 track samples
    const level2Map = new Map<string, SampleNode[]>()
    await Promise.all(
      level1.map(async (rel) => {
        const l2 = await prisma.sampleRelation.findMany({
          where: { samplingTrack: { id: rel.sampledTrackId } },
          include: {
            sampledTrack: {
              include: {
                credits: {
                  where: { role: 'performer' },
                  take: 1,
                  include: { artist: { select: { name: true } } },
                },
                releases: {
                  take: 1,
                  include: {
                    release: {
                      include: {
                        releaseGroup: { select: { firstReleaseDate: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          take: 3,
        })
        level2Map.set(
          rel.sampledTrackId,
          l2.map(r => nodeFromRelation(r))
        )
      })
    )

    return level1.map(rel => ({
      ...nodeFromRelation(rel),
      children: level2Map.get(rel.sampledTrackId) || [],
    }))
  } catch {
    return []
  }
}

// Helper: extract display fields from a SampleRelation include
function nodeFromRelation(rel: {
  sampledTrack: {
    mbid: string
    title: string
    credits: Array<{ artist: { name: string } }>
    releases: Array<{
      release: { releaseGroup: { firstReleaseDate: string | null } | null } | null
    }>
  }
}): SampleNode {
  const track = rel.sampledTrack
  const artistName = track.credits[0]?.artist.name ?? null
  const rawDate = track.releases[0]?.release?.releaseGroup?.firstReleaseDate ?? null
  const year = rawDate ? rawDate.slice(0, 4) : null
  return { mbid: track.mbid, title: track.title, artistName, year, children: [] }
}
```

**Step 2: Verify build**
```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -10
```

**Step 3: Commit**
```bash
git add apps/web/src/lib/data-service.ts
git commit -m "feat: add getRecordingSampleChain query"
```

---

### Task C2: Create SampleChain component

**Files:**
- Create: `apps/web/src/components/sample-chain.tsx`

**Step 1: Create the file**

```typescript
import Link from 'next/link'
import type { SampleNode } from '@/lib/data-service'

interface Props {
  roots: SampleNode[]
}

function SampleNodeRow({ node, depth }: { node: SampleNode; depth: number }) {
  const indent = depth * 20
  return (
    <>
      <div
        className="flex items-center gap-2 py-1.5 group"
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {depth > 0 && (
          <span className="text-muted-foreground/40 shrink-0 text-sm select-none">
            {'└─'}
          </span>
        )}
        <Link
          href={`/recording/${node.mbid}`}
          className="text-sm font-medium hover:text-primary transition-colors truncate"
        >
          {node.title}
        </Link>
        {(node.artistName || node.year) && (
          <span className="text-xs text-muted-foreground shrink-0">
            {[node.artistName, node.year].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      {node.children.map(child => (
        <SampleNodeRow key={child.mbid} node={child} depth={depth + 1} />
      ))}
    </>
  )
}

export function SampleChain({ roots }: Props) {
  if (!roots.length) return null
  return (
    <section>
      <h2 className="text-xl font-bold mb-3">Sample Ancestry</h2>
      <div className="rounded-xl border border-white/5 bg-[#0c0c10] px-2 py-3">
        {roots.map(root => (
          <SampleNodeRow key={root.mbid} node={root} depth={0} />
        ))}
      </div>
    </section>
  )
}
```

**Step 2: Verify build**
```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -10
```

**Step 3: Commit**
```bash
git add apps/web/src/components/sample-chain.tsx
git commit -m "feat: add SampleChain component"
```

---

### Task C3: Wire SampleChain into recording page

**Files:**
- Modify: `apps/web/src/app/recording/[mbid]/page.tsx`

**Step 1: Import**

Add at top:
```typescript
import { getRecordingSampleChain } from '@/lib/data-service'
import { SampleChain } from '@/components/sample-chain'
```

**Step 2: Fetch in parallel with existing data**

Find:
```typescript
const data = await getRecordingConnections(mbid)
```
Replace with:
```typescript
const [data, sampleChain] = await Promise.all([
  getRecordingConnections(mbid),
  getRecordingSampleChain(mbid),
])
```

**Step 3: Render below existing Samples section**

After the closing `)}` of the `{/* Samples */}` section, add:
```tsx
<SampleChain roots={sampleChain} />
```

**Step 4: Verify build**
```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -10
```

**Step 5: Commit**
```bash
git add apps/web/src/app/recording/[mbid]/page.tsx
git commit -m "feat: wire SampleChain onto recording page"
```

---

## Track D — Go-Live Infrastructure

### Task D1: Security headers in next.config.ts

**Files:**
- Modify: `apps/web/next.config.ts`

**Step 1: Replace content with**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@soundgraph/database"],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS: 2 years, include subdomains
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
};

export default nextConfig;
```

**Step 2: Verify build**
```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -10
```

**Step 3: Commit and push**
```bash
git add apps/web/next.config.ts
git commit -m "feat: add security headers to Next.js config"
git push origin main
```

---

### Task D2: Deploy updated code to Hetzner

**Run from local machine:**

```bash
ssh root@178.156.244.124 'cd /opt/soundgraph && git pull && pnpm build 2>&1 | tail -10 && pm2 restart soundgraph && echo done'
```

Expected: build succeeds, PM2 restarts.

Verify headers are set:
```bash
curl -si http://178.156.244.124:3000/ | grep -i 'x-frame\|x-content\|strict-transport'
```
Expected output includes `x-frame-options: DENY` and `x-content-type-options: nosniff`.

---

### Task D3: DB deploy to Hetzner

**Run from local machine (takes ~10 min for dump + restore):**

**Step 1: Dump local DB**
```bash
/opt/homebrew/opt/postgresql@16/bin/pg_dump \
  -Fc -U vmannem soundgraph_import \
  > /tmp/soundgraph_$(date +%Y%m%d).dump

ls -lh /tmp/soundgraph_*.dump
```
Expected: file ~1-3 GB.

**Step 2: Upload to Hetzner**
```bash
rsync -avz --progress /tmp/soundgraph_$(date +%Y%m%d).dump \
  root@178.156.244.124:/tmp/
```

**Step 3: Restore on Hetzner**
```bash
ssh root@178.156.244.124 << 'EOF'
# Drop existing data and restore fresh
sudo -u postgres dropdb --if-exists soundgraph_new
sudo -u postgres createdb soundgraph_new
sudo -u postgres pg_restore \
  --no-owner --role=soundgraph \
  -d soundgraph_new \
  /tmp/soundgraph_$(date +%Y%m%d).dump

# Grant permissions
sudo -u postgres psql -d soundgraph_new -c "
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO soundgraph;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO soundgraph;
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT ALL ON TABLES TO soundgraph;
"

# Verify
sudo -u postgres psql -d soundgraph_new -c "SELECT COUNT(*) FROM \"ReleaseRecording\";"
EOF
```
Expected: ReleaseRecording count > 0.

**Step 4: Switch app to new DB**
```bash
ssh root@178.156.244.124 << 'EOF'
# Update .env files to point to soundgraph_new
sed -i 's/soundgraph/soundgraph_new/g' /opt/soundgraph/apps/web/.env.local
sed -i 's/soundgraph/soundgraph_new/g' /opt/soundgraph/packages/database/.env
pm2 restart soundgraph
EOF
```

**Step 5: Verify**
Open `http://178.156.244.124:3000/artist/<drake-mbid>`. "Sound Evolution" heatmap should now render. Artist discography should show releases.

**Step 6: Cleanup dump file on Hetzner**
```bash
ssh root@178.156.244.124 'rm /tmp/soundgraph_*.dump'
```

---

### Task D4: Install nginx and configure reverse proxy

**Run on Hetzner:**

```bash
ssh root@178.156.244.124 << 'EOF'
apt-get install -y nginx

# Create site config (replace <DOMAIN> with your actual domain)
cat > /etc/nginx/sites-available/soundgraph << 'NGINX'
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;

server {
    listen 80;
    server_name <DOMAIN> www.<DOMAIN>;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name <DOMAIN> www.<DOMAIN>;

    ssl_certificate /etc/letsencrypt/live/<DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<DOMAIN>/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Rate limit search API
    location /api/search {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/soundgraph /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
EOF
```
Expected: `nginx: configuration file /etc/nginx/nginx.conf test is successful`

---

### Task D5: Buy domain and get HTTPS cert

**Step 1: Buy domain**
Go to https://domains.cloudflare.com — register your `.com` (~$10/yr). Cloudflare Registrar is at-cost.

**Step 2: DNS**
In Cloudflare DNS panel:
- Add A record: `@` → `178.156.244.124`, Proxy = **OFF** initially (orange cloud off)
- Add A record: `www` → `178.156.244.124`, Proxy = **OFF** initially

Wait ~5 min for propagation. Verify: `dig +short <DOMAIN>` should return `178.156.244.124`.

**Step 3: Get TLS cert**
```bash
ssh root@178.156.244.124 << 'EOF'
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d <DOMAIN> -d www.<DOMAIN> \
  --non-interactive --agree-tos --email <YOUR_EMAIL>
nginx -s reload
EOF
```
Expected: cert issued, nginx reloaded.

**Step 4: Enable Cloudflare proxy (optional)**
In Cloudflare DNS, flip the proxy toggle ON for both A records. This gives CDN + DDoS protection. Change SSL/TLS setting to "Full (strict)".

**Step 5: Verify HTTPS**
```bash
curl -si https://<DOMAIN>/ | head -5
```
Expected: `HTTP/2 200`

---

### Task D6: Firewall hardening on Hetzner

```bash
ssh root@178.156.244.124 << 'EOF'
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP (redirects to HTTPS)
ufw allow 443/tcp  # HTTPS
ufw --force enable
ufw status
EOF
```
Expected: UFW active, only ports 22/80/443 open.

Verify PostgreSQL is NOT publicly accessible:
```bash
nc -zv 178.156.244.124 5432
```
Expected: Connection refused (port 5432 blocked externally).

---

## Verification Checklist (run after all tasks complete)

```bash
# 1. Genre bubbles visible on artist page
open https://<DOMAIN>/artist/<drake-mbid>  # Genres circle in Connections section

# 2. Sound Evolution heatmap renders
# (visible after DB deploy - Task D3)

# 3. Sample chain on a recording with known samples
open https://<DOMAIN>/recording/<mbid-with-samples>  # Sample Ancestry section

# 4. HTTPS + security headers
curl -si https://<DOMAIN>/ | grep -i 'strict-transport\|x-frame\|x-content'

# 5. Rate limiting: rapid search requests should get 429 after 10 bursts
for i in {1..15}; do curl -so /dev/null -w "%{http_code}\n" "https://<DOMAIN>/api/search?q=drake"; done
```
