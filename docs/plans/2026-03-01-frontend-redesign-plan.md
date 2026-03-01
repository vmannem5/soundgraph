# SoundGraph Frontend Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform SoundGraph from a generic AI-look into a distinctive music platform with graph-first discovery, editorial aesthetics, and smooth interactions.

**Architecture:** Incremental surface-by-surface redesign. Start with the design system foundation (fonts, colors, avatars), then fix the critical mind map scroll bug, then redesign each page surface. Data layer and routing stay unchanged.

**Tech Stack:** Next.js 15, React 19, React Flow v12, Tailwind CSS v4 (OKLch), shadcn/ui, Inter + Space Grotesk fonts, SVG generative avatars.

---

## Task 1: Design System — Fonts

**Files:**
- Modify: `apps/web/src/app/layout.tsx` (lines 1-15, font imports and variables)
- Modify: `apps/web/src/app/globals.css` (lines 7-48, theme inline block)

**Step 1: Install Inter and Space Grotesk**

Run: `pnpm --filter @soundgraph/web add @fontsource-variable/inter @fontsource-variable/space-grotesk`

Alternatively, use `next/font/google` which is already available:

**Step 2: Replace Geist fonts with Inter + Space Grotesk in layout.tsx**

Replace the Geist font imports (lines 1-15) with:

```tsx
import { Inter, Space_Grotesk } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})
```

Update the `<body>` className to use `${inter.variable} ${spaceGrotesk.variable}` instead of the Geist variables.

**Step 3: Update globals.css font references**

In the `@theme inline` block, replace the Geist font family references with:

```css
--font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
--font-heading: var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif;
```

Add a utility for headings in the base layer:

```css
h1, h2, h3, h4 { font-family: var(--font-heading); }
```

**Step 4: Verify fonts load**

Run: `pnpm dev`
Open `http://localhost:3000` — body text should be Inter, headings should be Space Grotesk.

**Step 5: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css apps/web/package.json pnpm-lock.yaml
git commit -m "feat: replace Geist with Inter + Space Grotesk fonts"
```

---

## Task 2: Design System — Color Palette

**Files:**
- Modify: `apps/web/src/app/globals.css` (lines 50-126)

**Step 1: Update dark theme colors for warm charcoal base + amber/blue accents**

Replace the dark theme `:root.dark` block (lines 85-117) with warmer charcoal tones and amber/blue accents. Key changes:

```css
.dark {
  --background: oklch(0.16 0.01 250);       /* warm dark charcoal, slight blue */
  --foreground: oklch(0.93 0.01 80);        /* warm off-white */
  --card: oklch(0.19 0.01 250);             /* slightly lighter card bg */
  --card-foreground: oklch(0.93 0.01 80);
  --primary: oklch(0.75 0.15 70);           /* warm amber/gold */
  --primary-foreground: oklch(0.16 0.01 250);
  --secondary: oklch(0.25 0.02 250);        /* muted dark blue-grey */
  --secondary-foreground: oklch(0.93 0.01 80);
  --accent: oklch(0.60 0.12 250);           /* cool blue accent */
  --accent-foreground: oklch(0.93 0.01 80);
  --muted: oklch(0.22 0.01 250);
  --muted-foreground: oklch(0.60 0.02 250);
  --destructive: oklch(0.55 0.2 25);        /* warm red-orange */
  --border: oklch(0.28 0.01 250);
  --input: oklch(0.28 0.01 250);
  --ring: oklch(0.75 0.15 70);              /* amber ring to match primary */
}
```

Also update the 5 chart colors to use the amber/blue palette:
```css
--chart-1: oklch(0.75 0.15 70);   /* amber */
--chart-2: oklch(0.60 0.12 250);  /* blue */
--chart-3: oklch(0.65 0.12 150);  /* teal */
--chart-4: oklch(0.70 0.10 30);   /* warm coral */
--chart-5: oklch(0.55 0.15 310);  /* purple */
```

**Step 2: Update light theme similarly** (optional — dark is primary)

Keep light theme functional but shift primary to amber too for consistency.

**Step 3: Verify colors**

Run: `pnpm dev` — check dark mode. Background should feel warm, not clinical black. Amber accents should be visible on interactive elements.

**Step 4: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat: warm charcoal + amber/blue color palette"
```

---

## Task 3: Design System — Spacing & Density

**Files:**
- Modify: `apps/web/src/app/globals.css` (base layer, lines 119-126)

**Step 1: Tighten global spacing defaults**

In the `@theme inline` block, update radius:
```css
--radius: 0.5rem;  /* slightly tighter from 0.625rem */
```

**Step 2: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat: tighten spacing defaults for density"
```

---

## Task 4: Generated Avatar System

**Files:**
- Create: `apps/web/src/lib/avatar.tsx`

**Step 1: Create the deterministic SVG avatar generator**

Create `apps/web/src/lib/avatar.tsx`:

```tsx
'use client'

// Genre-based color palettes
const GENRE_PALETTES: Record<string, string[]> = {
  jazz:       ['#c4956a', '#d4a574', '#8b6f47', '#e8c9a0'],
  electronic: ['#6ecfcf', '#9b8bc4', '#4a9aca', '#b06ec4'],
  'hip-hop':  ['#c45a5a', '#d48a4a', '#c47a3a', '#e8a060'],
  rock:       ['#7a8b9c', '#5a6b7c', '#9aaabb', '#4a5b6c'],
  pop:        ['#c46a9b', '#d49abb', '#9b6ac4', '#e8a0c0'],
  classical:  ['#9b9b6a', '#c4c49a', '#7a7a4a', '#d4d4b0'],
  default:    ['#8b9cc4', '#c4956a', '#6ec4a0', '#c46a8b'],
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
}

function getPalette(genres: string[]): string[] {
  const genre = genres[0]?.toLowerCase() || ''
  for (const [key, palette] of Object.entries(GENRE_PALETTES)) {
    if (genre.includes(key)) return palette
  }
  return GENRE_PALETTES.default
}

export function GeneratedAvatar({
  id,
  name,
  genres = [],
  size = 72,
}: {
  id: string
  name: string
  genres?: string[]
  size?: number
}) {
  const seed = hashString(id || name)
  const rand = seededRandom(seed)
  const palette = getPalette(genres)

  // Generate 4-6 geometric shapes
  const shapeCount = 4 + Math.floor(rand() * 3)
  const shapes: React.ReactNode[] = []

  for (let i = 0; i < shapeCount; i++) {
    const color = palette[Math.floor(rand() * palette.length)]
    const opacity = 0.3 + rand() * 0.5
    const type = Math.floor(rand() * 3) // 0=circle, 1=arc, 2=line

    if (type === 0) {
      const cx = rand() * size
      const cy = rand() * size
      const r = size * 0.1 + rand() * size * 0.35
      shapes.push(
        <circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity={opacity} />
      )
    } else if (type === 1) {
      const cx = rand() * size
      const cy = rand() * size
      const r = size * 0.2 + rand() * size * 0.3
      const startAngle = rand() * Math.PI * 2
      const endAngle = startAngle + Math.PI * 0.5 + rand() * Math.PI
      const x1 = cx + r * Math.cos(startAngle)
      const y1 = cy + r * Math.sin(startAngle)
      const x2 = cx + r * Math.cos(endAngle)
      const y2 = cy + r * Math.sin(endAngle)
      shapes.push(
        <path
          key={i}
          d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
          stroke={color}
          strokeWidth={size * 0.04 + rand() * size * 0.06}
          fill="none"
          opacity={opacity}
          strokeLinecap="round"
        />
      )
    } else {
      const x1 = rand() * size
      const y1 = rand() * size
      const x2 = rand() * size
      const y2 = rand() * size
      shapes.push(
        <line
          key={i}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color}
          strokeWidth={size * 0.02 + rand() * size * 0.04}
          opacity={opacity}
          strokeLinecap="round"
        />
      )
    }
  }

  // Dark background matching theme
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      <rect width={size} height={size} fill="oklch(0.19 0.01 250)" rx={size * 0.08} />
      {shapes}
    </svg>
  )
}
```

**Step 2: Verify it renders**

Temporarily import and render `<GeneratedAvatar id="test" name="Test" size={72} />` in any page. Confirm unique SVG appears.

**Step 3: Commit**

```bash
git add apps/web/src/lib/avatar.tsx
git commit -m "feat: add deterministic SVG avatar generator"
```

---

## Task 5: Fix Mind Map Scroll Bug

**Files:**
- Modify: `apps/web/src/app/recording/[mbid]/page.tsx` (lines 52-161, tabs structure)
- Modify: `apps/web/src/components/knowledge-graph.tsx` (lines 267-324, ReactFlow wrapper)

**Step 1: Give the React Flow container a fixed height with overflow hidden**

In `knowledge-graph.tsx`, find the outermost wrapper `<div>` around `<ReactFlow>` (around line 270). Set it to a fixed height:

```tsx
<div style={{ height: '70vh', overflow: 'hidden', position: 'relative' }}>
  <ReactFlow ... />
</div>
```

Remove `zoomOnScroll={false}` and `preventScrolling={false}` — these are the props that were supposed to fix scrolling but aren't working. Instead, the fixed-height container with `overflow: hidden` prevents the graph from interfering with page scroll entirely. Users interact with the graph via drag, pan (mouse drag), and pinch zoom only.

**Step 2: Remove tabs — show mind map as primary content**

In `recording/[mbid]/page.tsx`, replace the `<Tabs>` structure (lines 52-161) with:

1. The knowledge graph directly (no tab wrapper), in a section with a heading
2. Credits section below (always visible, no tab)
3. Performers section below (always visible, no tab)
4. Samples section below (always visible, no tab)

Each section gets a heading like `<h2 className="font-heading text-xl font-bold mb-3">Credits</h2>` and the content from the current tab panels.

**Step 3: Test scrolling**

Run: `pnpm dev`
Navigate to any recording page (e.g., `/recording/` + an MBID with connections).
- Scroll down past the hero — page should scroll normally
- The mind map should be visible in its 70vh container
- Drag inside the graph to pan, pinch to zoom
- Scroll continues below the graph to credits/performers/samples sections

**Step 4: Commit**

```bash
git add apps/web/src/components/knowledge-graph.tsx apps/web/src/app/recording/\\[mbid\\]/page.tsx
git commit -m "fix: mind map scroll bug — fixed height container, remove tabs"
```

---

## Task 6: Recording Page — Editorial Hero

**Files:**
- Modify: `apps/web/src/components/recording-header.tsx` (lines 22-77)
- Modify: `apps/web/src/app/recording/[mbid]/page.tsx`
- Modify: `apps/web/src/components/spotify-embed.tsx` (lines 3-21)

**Step 1: Redesign recording-header.tsx as a full-width editorial hero**

Replace the current Card-based layout with:

```tsx
<div className="relative w-full overflow-hidden rounded-2xl">
  {/* Gradient banner from album art or generated avatar colors */}
  <div
    className="absolute inset-0 opacity-40 blur-3xl"
    style={{
      backgroundImage: albumArt
        ? `url(${albumArt})`
        : 'linear-gradient(135deg, oklch(0.75 0.15 70), oklch(0.60 0.12 250))',
      backgroundSize: 'cover',
    }}
  />
  <div className="relative flex items-end gap-6 p-8">
    {/* Large album art */}
    <div className="shrink-0">
      {albumArt ? (
        <img src={albumArt} alt="" className="w-44 h-44 rounded-xl shadow-2xl ring-1 ring-white/10" />
      ) : (
        <GeneratedAvatar id={recording.mbid} name={recording.title} size={176} />
      )}
    </div>
    {/* Title + artist + stats */}
    <div className="flex flex-col gap-2 pb-2">
      <h1 className="text-4xl font-bold tracking-tight">{recording.title}</h1>
      {/* Artist links */}
      {/* Compact stats badges: duration, credits, samples, year */}
    </div>
  </div>
</div>
```

**Step 2: Integrate compact Spotify player into hero**

Update `spotify-embed.tsx` — pass `compact={true}` from the recording page. Position the player at the bottom of the hero section.

**Step 3: Verify**

Recording page should show a large editorial hero with blurred album art background, large cover art, bold title, and a compact player strip.

**Step 4: Commit**

```bash
git add apps/web/src/components/recording-header.tsx apps/web/src/app/recording/\\[mbid\\]/page.tsx apps/web/src/components/spotify-embed.tsx
git commit -m "feat: editorial hero for recording page with gradient banner"
```

---

## Task 7: Knowledge Graph Visual Upgrade

**Files:**
- Modify: `apps/web/src/components/knowledge-graph.tsx` (lines 69-265, buildGraphData)

**Step 1: Upgrade center node with glowing ring**

In `buildGraphData`, update the center node style (around line 80-106):

```tsx
style: {
  // existing background image/gradient stays
  boxShadow: '0 0 40px 8px oklch(0.75 0.15 70 / 0.3)', // amber glow
  border: '2px solid oklch(0.75 0.15 70 / 0.5)',
}
```

**Step 2: Add album art thumbnails to recording nodes**

When building connection nodes that are recordings (samples), check if we have Spotify data to show a small album art in the node background. For artist nodes, use the generated avatar or a small circle.

Update node data to include image URL if available, and render accordingly in node style.

**Step 3: Add inline expansion on click**

Replace the current `onNodeClick` handler (which navigates via `router.push`). New behavior:
- Single click: expand a tooltip/popover showing node details (name, type, connection count) + a "View" button
- Double click (`onNodeDoubleClick`): navigate to the entity page

This requires adding state for `selectedNode` and rendering a positioned card overlay within the React Flow container.

**Step 4: Verify**

- Center node should have an amber glow
- Recording nodes should show album art thumbnails where available
- Single-click shows info popover, double-click navigates

**Step 5: Commit**

```bash
git add apps/web/src/components/knowledge-graph.tsx
git commit -m "feat: knowledge graph visual upgrade — glow, thumbnails, inline expansion"
```

---

## Task 8: Search Results — Grid Cards with Avatars

**Files:**
- Modify: `apps/web/src/components/search-results.tsx` (lines 60-217)

**Step 1: Replace ArtistTile with grid cards**

Replace the horizontal-scroll artist tiles (60-97) with a responsive grid:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
  {artists.map((artist) => (
    <Link key={artist.mbid} href={`/artist/${artist.mbid}`}>
      <div className="group relative aspect-square rounded-xl overflow-hidden bg-card">
        {artist.imageUrl ? (
          <img src={artist.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <GeneratedAvatar id={artist.mbid} name={artist.name} genres={artist.tags} size={200} />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
          <p className="text-sm font-semibold text-white truncate">{artist.name}</p>
        </div>
      </div>
    </Link>
  ))}
</div>
```

**Step 2: Replace RecordingRow with rectangular cards**

Replace the list rows (99-137) with a card grid:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
  {recordings.map((rec) => (
    <Link key={rec.mbid} href={`/recording/${rec.mbid}`}>
      <div className="group flex items-center gap-4 p-3 rounded-xl bg-card hover:bg-accent/10 transition-colors">
        {/* Album art or avatar */}
        <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden">
          {trackImage ? (
            <img src={trackImage} className="w-full h-full object-cover" />
          ) : (
            <GeneratedAvatar id={rec.mbid} name={rec.title} size={64} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{rec.title}</p>
          <p className="text-sm text-muted-foreground truncate">{artistNames}</p>
          {/* Tags/badges if available */}
        </div>
      </div>
    </Link>
  ))}
</div>
```

**Step 3: Add client-side sort toggle**

Add a sort dropdown above results with options: Popularity (default), Most Connected, Name A-Z. Sort is client-side only (reorders the already-fetched results array).

```tsx
const [sortBy, setSortBy] = useState<'popularity' | 'connections' | 'name'>('popularity')
```

**Step 4: Verify**

- Artists appear as a grid of square image cards with name overlaid
- Recordings appear as rectangular cards with album art + text
- Missing images show unique generated avatars
- Sort toggle reorders results without page reload

**Step 5: Commit**

```bash
git add apps/web/src/components/search-results.tsx
git commit -m "feat: grid card search results with generated avatars and sort"
```

---

## Task 9: Search — Dropdown Overlay

**Files:**
- Modify: `apps/web/src/components/search-bar.tsx` (lines 1-95)
- Modify: `apps/web/src/app/page.tsx` (lines 12-52)

**Step 1: Convert SearchBar to client-side fetching with dropdown**

Instead of updating the URL and triggering a server re-render, have the search bar call `/api/search?q=` directly and show results in a dropdown overlay beneath the input.

```tsx
const [results, setResults] = useState<SearchResults | null>(null)
const [isOpen, setIsOpen] = useState(false)

async function handleSearch(query: string) {
  if (query.length < 2) { setResults(null); setIsOpen(false); return }
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  const data = await res.json()
  setResults(data)
  setIsOpen(true)
}
```

Render a positioned dropdown below the input showing top 5 artists + top 5 recordings as compact rows. "See all results" link at bottom navigates to `/?q=query` for the full results page.

**Step 2: Keep full results page working**

The `page.tsx` server component still fetches results when `?q=` is in the URL. The dropdown is for quick access; the full page is for browsing.

**Step 3: Verify**

- Type in search bar → dropdown appears with quick results
- Click "See all" → navigates to full page with grid results
- Click a result in dropdown → navigates to artist/recording page

**Step 4: Commit**

```bash
git add apps/web/src/components/search-bar.tsx apps/web/src/app/page.tsx
git commit -m "feat: instant search dropdown overlay"
```

---

## Task 10: Home Page — Graph Discovery

**Files:**
- Modify: `apps/web/src/app/page.tsx` (full rewrite)
- Create: `apps/web/src/components/discovery-graph.tsx`
- Modify: `apps/web/src/lib/data-service.ts` (add discovery data queries)

**Step 1: Add discovery data queries to data-service.ts**

Add functions to fetch curated data for the home page:

```typescript
export async function getDiscoveryData() {
  // Most sampled recordings (top 20 by sample relation count)
  const mostSampled = await prisma.$queryRaw`
    SELECT r.mbid, r.title, r."spotifyId",
      (SELECT count(*) FROM "SampleRelation" WHERE "sampledRecordingId" = r.id)::int as sample_count
    FROM "Recording" r
    WHERE EXISTS (SELECT 1 FROM "SampleRelation" WHERE "sampledRecordingId" = r.id)
    ORDER BY sample_count DESC
    LIMIT 20
  `

  // Top producers (most credits with role='producer')
  const topProducers = await prisma.$queryRaw`
    SELECT a.mbid, a.name, a."spotifyId", a."imageUrl",
      count(*)::int as credit_count
    FROM "Artist" a
    JOIN "Credit" c ON c."artistId" = a.id
    WHERE c.role = 'producer'
    GROUP BY a.id
    ORDER BY credit_count DESC
    LIMIT 15
  `

  // Sample connections for graph edges (top 30 most-connected pairs)
  const sampleEdges = await prisma.$queryRaw`
    SELECT
      r1.mbid as source_mbid, r1.title as source_title,
      r2.mbid as target_mbid, r2.title as target_title
    FROM "SampleRelation" sr
    JOIN "Recording" r1 ON r1.id = sr."recordingId"
    JOIN "Recording" r2 ON r2.id = sr."sampledRecordingId"
    WHERE r1.popularity > 50 OR r2.popularity > 50
    ORDER BY r1.popularity + r2.popularity DESC
    LIMIT 30
  `

  return { mostSampled, topProducers, sampleEdges }
}
```

**Step 2: Create DiscoveryGraph component**

Create `apps/web/src/components/discovery-graph.tsx` — a React Flow (or d3-force) visualization showing a network of the most-connected recordings/artists.

- ~20-30 nodes (from `mostSampled` + artists connected to them)
- Nodes are circles with album art or generated avatars, sized by connection count
- Edges from `sampleEdges` colored by type
- Gentle force-directed layout (using React Flow with initial positions calculated via d3-force)
- Fixed height container (60vh) with `overflow: hidden`
- Click navigates to entity page

**Step 3: Redesign page.tsx**

Replace the current home page layout:

```tsx
export default async function Home({ searchParams }: Props) {
  const q = (await searchParams)?.q as string
  const discoveryData = await getDiscoveryData()

  return (
    <main className="min-h-screen">
      {/* Search bar — persistent, full width */}
      <section className="px-6 pt-8 pb-4 max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-6 tracking-tight">
          SoundGraph
        </h1>
        <Suspense><SearchBar /></Suspense>
      </section>

      {/* If searching, show results */}
      {q && results ? (
        <section className="max-w-6xl mx-auto px-6">
          <SearchResults results={results} />
        </section>
      ) : (
        <>
          {/* Discovery graph */}
          <section className="px-6 py-4">
            <DiscoveryGraph data={discoveryData} />
          </section>

          {/* Editorial rows */}
          <section className="max-w-6xl mx-auto px-6 py-6 space-y-8">
            {/* Most Sampled */}
            <div>
              <h2 className="text-xl font-bold mb-3">Most Sampled</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {/* Album art cards with sample count badges */}
              </div>
            </div>
            {/* Top Producers */}
            <div>
              <h2 className="text-xl font-bold mb-3">Top Producers</h2>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {/* Producer avatar cards with credit counts */}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
```

**Step 4: Verify**

- Home page shows search bar + interactive graph + editorial rows
- Graph nodes are clickable and navigate to entity pages
- Searching replaces graph with results
- Graph doesn't interfere with page scroll

**Step 5: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/components/discovery-graph.tsx apps/web/src/lib/data-service.ts
git commit -m "feat: graph discovery home page with most sampled and top producers"
```

---

## Task 11: Artist Page — Editorial Hero + Visual Discography

**Files:**
- Modify: `apps/web/src/app/artist/[mbid]/page.tsx` (lines 39-159)

**Step 1: Add editorial hero banner**

Replace the Card-based header (lines 80-131) with a full-width hero similar to the recording page:

```tsx
<div className="relative w-full overflow-hidden rounded-2xl mb-8">
  {/* Blurred artist image background */}
  <div className="absolute inset-0 opacity-30 blur-3xl" style={{
    backgroundImage: artist.imageUrl ? `url(${artist.imageUrl})` : undefined,
    backgroundColor: !artist.imageUrl ? 'oklch(0.25 0.05 250)' : undefined,
    backgroundSize: 'cover',
  }} />
  <div className="relative flex items-end gap-6 p-8">
    {/* Large circular image or avatar */}
    <div className="shrink-0">
      {artist.imageUrl ? (
        <img src={artist.imageUrl} className="w-40 h-40 rounded-full shadow-2xl ring-2 ring-white/10 object-cover" />
      ) : (
        <GeneratedAvatar id={artist.mbid} name={artist.name} size={160} />
      )}
    </div>
    <div className="flex flex-col gap-2 pb-2">
      <h1 className="text-4xl font-bold tracking-tight">{artist.name}</h1>
      {/* Genre pills, follower count, country/lifespan badges */}
    </div>
  </div>
</div>
```

**Step 2: Convert discography to visual grid**

Replace the list-based discography (lines 133-159) with a grid of album art cards:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
  {releaseGroups.map((rg) => (
    <Link key={rg.id} href={`/release-group/${rg.id}`}>
      <div className="group space-y-2">
        <div className="aspect-square rounded-lg overflow-hidden bg-card">
          {/* Album art from Spotify or GeneratedAvatar */}
          <GeneratedAvatar id={rg.id} name={rg.title} size={200} />
        </div>
        <p className="text-sm font-medium truncate">{rg.title}</p>
        <p className="text-xs text-muted-foreground">{rg.firstReleaseDate?.slice(0,4)} · {rg.type}</p>
      </div>
    </Link>
  ))}
</div>
```

**Step 3: Add artist connections mini-graph**

Add a section below discography with a mini knowledge graph showing this artist's collaborators. Reuse the `KnowledgeGraph` component but pass artist-scoped connection data.

This requires a new data function `getArtistConnections(mbid)` in `data-service.ts` that queries credits to find other artists this person has worked with.

**Step 4: Verify**

- Artist page has editorial hero with blurred background
- Discography is a visual grid
- Mini connection graph shows collaborators below

**Step 5: Commit**

```bash
git add apps/web/src/app/artist/\\[mbid\\]/page.tsx apps/web/src/lib/data-service.ts
git commit -m "feat: artist page editorial hero, visual discography, connections graph"
```

---

## Task 12: Nav Header Polish

**Files:**
- Modify: `apps/web/src/components/nav-header.tsx` (lines 6-38)

**Step 1: Add persistent search to nav header**

Add a compact search input to the nav header (visible on all pages except home). When focused, it expands and shows the dropdown overlay.

**Step 2: Update logo styling**

Update the gradient to use the new amber/blue palette instead of purple→pink→orange:

```tsx
className="bg-gradient-to-r from-amber-400 via-orange-400 to-blue-400 bg-clip-text text-transparent"
```

**Step 3: Commit**

```bash
git add apps/web/src/components/nav-header.tsx
git commit -m "feat: nav header with persistent search and updated branding"
```

---

## Task 13: Animations & Polish

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: various components for hover effects

**Step 1: Add card hover effects globally**

In `globals.css`, add transition utilities:

```css
.card-hover {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px -5px oklch(0 0 0 / 0.3);
}
```

Apply `card-hover` class to artist cards, recording cards, and discography cards.

**Step 2: Add subtle page transitions**

Use Next.js `loading.tsx` files with fade-in animations for route transitions.

**Step 3: Verify all pages**

Walk through every page and verify:
- Fonts are Inter + Space Grotesk
- Colors are warm charcoal + amber/blue
- All images have generated avatar fallbacks
- Mind map scrolls correctly
- Search dropdown works
- Home page shows discovery graph
- Cards have hover effects

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: animations, hover effects, and final polish"
```

---

## Execution Order & Dependencies

```
Task 1 (Fonts) ──────────┐
Task 2 (Colors) ─────────┤
Task 3 (Spacing) ────────┤── Foundation (no dependencies)
Task 4 (Avatars) ────────┘
         │
Task 5 (Mind Map Scroll Fix) ── Critical bug fix
         │
Task 6 (Recording Hero) ────── Depends on Task 4 (avatars)
Task 7 (Graph Visual Upgrade) ─ Depends on Task 5
Task 8 (Search Cards) ──────── Depends on Task 4 (avatars)
Task 9 (Search Dropdown) ───── Depends on Task 8
Task 10 (Home Discovery) ───── Depends on Tasks 4, 7
Task 11 (Artist Page) ──────── Depends on Task 4
Task 12 (Nav Header) ───────── Depends on Task 9
Task 13 (Polish) ────────────── Last, depends on all above
```

Tasks 1-4 can be done in parallel. Task 5 is the critical bug fix. Tasks 6-12 depend on the foundation but are mostly independent of each other.
