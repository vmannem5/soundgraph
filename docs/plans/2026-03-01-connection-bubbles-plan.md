# Connection Bubbles Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the React Flow mind map with a d3-pack SVG bubble chart that sizes nodes by importance and supports expand/collapse clusters.

**Architecture:** `ConnectionBubbles` is a `'use client'` SVG component that receives the same `connections` array as `KnowledgeGraph` did. It builds a three-level d3-hierarchy (root → category clusters → leaf nodes), runs `d3.pack()` once to get `x/y/r` for every circle, then renders them as SVG. Expand/collapse is pure React state — no d3 mutation after mount. Credits get an extra subcategory level (Producers, Engineers & Mix). Importance comes from `Artist.popularity` and `Recording.popularity` columns already in the DB (log-normalized so historical classics with high credit counts and modern hits with moderate but meaningful scores both size well).

**Tech Stack:** `d3-hierarchy` (pack layout), React SVG, Next.js App Router, existing Prisma data layer.

---

### Task 1: Install d3-hierarchy

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install the package**

Run from repo root:
```bash
pnpm --filter @soundgraph/web add d3-hierarchy
pnpm --filter @soundgraph/web add -D @types/d3-hierarchy
```

**Step 2: Verify install**

```bash
cat apps/web/package.json | grep d3-hierarchy
```
Expected: `"d3-hierarchy": "^3.x.x"` in dependencies.

**Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add d3-hierarchy for bubble chart layout"
```

---

### Task 2: Add `importance` to Connection type and DB queries

**Files:**
- Modify: `apps/web/src/lib/data-service.ts`

The `connections` array built in `getRecordingConnections` currently lacks importance data. The Prisma include for `credits` already fetches `artist: true` (all fields including `artist.popularity`). Same for `samplesUsed.sampledTrack` and `sampledBy.samplingTrack` — they include the full `Recording` model with `popularity`. We just need to thread it through.

**Step 1: Update the Connection type (lines 330–337)**

Find the inline type declaration for the `connections` array:
```typescript
const connections: {
  type: string
  label: string
  targetType: string
  targetId: string
  targetName: string
  attributes?: string[]
}[] = []
```

Add `importance?: number`:
```typescript
const connections: {
  type: string
  label: string
  targetType: string
  targetId: string
  targetName: string
  attributes?: string[]
  importance?: number
}[] = []
```

**Step 2: Thread `importance` through credit connections (lines ~352–361)**

The existing credit push:
```typescript
connections.push({
  type: credit.role,
  label: credit.role,
  targetType: 'artist',
  targetId: credit.artist.mbid,
  targetName: credit.artist.name,
  attributes: credit.instrument ? [credit.instrument] : undefined,
})
```

Add `importance`:
```typescript
connections.push({
  type: credit.role,
  label: credit.role,
  targetType: 'artist',
  targetId: credit.artist.mbid,
  targetName: credit.artist.name,
  attributes: credit.instrument ? [credit.instrument] : undefined,
  importance: credit.artist.popularity || 0,
})
```

**Step 3: Thread `importance` through sample connections (lines ~364–373 and ~376–384)**

For `samplesUsed`:
```typescript
connections.push({
  type: 'samples material',
  label: 'samples',
  targetType: 'recording',
  targetId: sample.sampledTrack.mbid,
  targetName: `${sample.sampledTrack.title}${artistName ? ` (${artistName})` : ''}`,
  importance: sample.sampledTrack.popularity || 0,
})
```

For `sampledBy`:
```typescript
connections.push({
  type: 'sampled by',
  label: 'sampled by',
  targetType: 'recording',
  targetId: sample.samplingTrack.mbid,
  targetName: `${sample.samplingTrack.title}${artistName ? ` (${artistName})` : ''}`,
  importance: sample.samplingTrack.popularity || 0,
})
```

**Step 4: Update `getArtistConnections` return type (line ~523)**

The function currently returns `{ topCollaborators, topProducers, samplesFrom, sampledBy }`. These are used in the artist page to build inline connection objects. The `samplesFrom`/`sampledBy` SQL queries already SELECT `r_sampled.popularity` (it's in the GROUP BY). Add it to the TypeScript type annotation:

Find (line ~484):
```typescript
prisma.$queryRaw<Array<{
  rec_mbid: string; rec_title: string
  artist_mbid: string | null; artist_name: string | null
}>>`
```

Update both `samplesFrom` and `sampledBy` query types to include `popularity`:
```typescript
prisma.$queryRaw<Array<{
  rec_mbid: string; rec_title: string
  artist_mbid: string | null; artist_name: string | null
  popularity: number | null
}>>`
```

**Step 5: Verify the server still compiles**

```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -20
```
Expected: no TypeScript errors related to `importance` or `popularity`.

**Step 6: Commit**

```bash
git add apps/web/src/lib/data-service.ts
git commit -m "feat: add importance field to connection objects from DB popularity"
```

---

### Task 3: Create `ConnectionBubbles` component — data layer

**Files:**
- Create: `apps/web/src/components/connection-bubbles.tsx`

This task creates the file with types, category config, and hierarchy builder. No rendering yet.

**Step 1: Create the file with types and category config**

```typescript
'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { hierarchy, pack } from 'd3-hierarchy'
import type { HierarchyCircularNode } from 'd3-hierarchy'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Connection {
  type: string
  label: string
  targetType: string
  targetId: string
  targetName: string
  importance?: number
  attributes?: string[]
}

interface BubbleData {
  id: string
  name: string
  targetType?: string
  targetId?: string
  importance: number
  color: string
  bg: string
  isCategory?: boolean
  isSubcategory?: boolean
  children?: BubbleData[]
}

// ── Category config ────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  'SAMPLES FROM': { label: 'Samples From', color: '#c4956a', bg: 'rgba(196,149,106,0.18)' },
  'SAMPLED BY':   { label: 'Sampled By',   color: '#8b9cc4', bg: 'rgba(139,156,196,0.18)' },
  'CREDITS':      { label: 'Credits',       color: '#d6d3d1', bg: 'rgba(214,211,209,0.10)' },
  'PERFORMERS':   { label: 'Performers',    color: '#a3a3a3', bg: 'rgba(163,163,163,0.10)' },
}

// Order: samples always first
const CATEGORY_ORDER = ['SAMPLES FROM', 'SAMPLED BY', 'CREDITS', 'PERFORMERS']

const CREDITS_SUBGROUP: Record<string, string> = {
  producer: 'Producers', composer: 'Producers', lyricist: 'Producers',
  writer: 'Producers', arranger: 'Producers',
  engineer: 'Engineers & Mix', mix: 'Engineers & Mix',
  audio: 'Engineers & Mix', mastering: 'Engineers & Mix',
}

function getCategoryKey(type: string): string {
  const t = type.toLowerCase()
  if (t === 'samples material' || t === 'sample' || t === 'samples from' || t.startsWith('sample') && !t.includes('by')) return 'SAMPLES FROM'
  if (t === 'sampled by' || t.includes('sampled by')) return 'SAMPLED BY'
  if (t === 'performer' || t.includes('vocal') || t.includes('instrument') || t.includes('performance')) return 'PERFORMERS'
  return 'CREDITS'
}
```

**Step 2: Add `buildHierarchy` function**

```typescript
// ── Hierarchy builder ──────────────────────────────────────────────────────

function buildHierarchy(connections: Connection[]): BubbleData {
  const maxImp = Math.max(...connections.map(c => c.importance || 1), 1)
  const norm = (imp: number) =>
    Math.max(1, (Math.log1p(imp || 1) / Math.log1p(maxImp)) * 100)

  // Group by category, deduplicating by targetId
  const groups = new Map<string, Connection[]>()
  const seenIds = new Set<string>()
  for (const conn of connections) {
    const cat = getCategoryKey(conn.type)
    if (!groups.has(cat)) groups.set(cat, [])
    const key = `${cat}-${conn.targetId}`
    if (!seenIds.has(key)) {
      seenIds.add(key)
      groups.get(cat)!.push(conn)
    }
  }

  const children: BubbleData[] = []

  const sortedGroups = [...groups.entries()].sort(
    ([a], [b]) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  )

  for (const [cat, conns] of sortedGroups) {
    const style = CATEGORY_STYLES[cat] || { label: cat, color: '#6b7280', bg: 'rgba(107,114,128,0.10)' }

    if (cat === 'CREDITS') {
      // Sub-group by role type
      const subMap = new Map<string, Connection[]>()
      for (const conn of conns) {
        const sg = CREDITS_SUBGROUP[conn.type.toLowerCase()] || 'Other Credits'
        if (!subMap.has(sg)) subMap.set(sg, [])
        subMap.get(sg)!.push(conn)
      }

      const subchildren: BubbleData[] = []
      for (const [sgLabel, sgConns] of subMap) {
        const leaves = sgConns.slice(0, 12).map(c => ({
          id: `leaf-${c.targetId}-${c.type}`,
          name: c.targetName,
          targetType: c.targetType,
          targetId: c.targetId,
          importance: norm(c.importance || 1),
          color: style.color,
          bg: style.bg,
        }))
        subchildren.push({
          id: `subcat-${sgLabel}`,
          name: sgLabel,
          isSubcategory: true,
          importance: leaves.reduce((s, n) => s + n.importance, 0),
          color: style.color,
          bg: style.bg,
          children: leaves,
        })
      }

      children.push({
        id: 'cat-CREDITS',
        name: style.label,
        isCategory: true,
        importance: subchildren.reduce((s, n) => s + n.importance, 0),
        color: style.color,
        bg: style.bg,
        children: subchildren,
      })
    } else {
      const overflow = Math.max(0, conns.length - 12)
      const leaves = conns.slice(0, 12).map(c => ({
        id: `leaf-${c.targetId}-${c.type}`,
        name: c.targetName,
        targetType: c.targetType,
        targetId: c.targetId,
        importance: norm(c.importance || 1),
        color: style.color,
        bg: style.bg,
      }))
      if (overflow > 0) {
        leaves.push({
          id: `overflow-${cat}`,
          name: `+${overflow} more`,
          importance: norm(1),
          color: style.color,
          bg: style.bg,
        })
      }

      children.push({
        id: `cat-${cat}`,
        name: style.label,
        isCategory: true,
        importance: leaves.reduce((s, n) => s + n.importance, 0),
        color: style.color,
        bg: style.bg,
        children: leaves,
      })
    }
  }

  return { id: 'root', name: 'root', importance: 1, color: 'transparent', bg: 'transparent', children }
}
```

**Step 3: Commit**

```bash
git add apps/web/src/components/connection-bubbles.tsx
git commit -m "feat: add ConnectionBubbles data layer (hierarchy builder)"
```

---

### Task 4: Add pack layout and SVG rendering to `ConnectionBubbles`

**Files:**
- Modify: `apps/web/src/components/connection-bubbles.tsx`

**Step 1: Add pack layout constants and helper**

Append to `connection-bubbles.tsx` after `buildHierarchy`:

```typescript
// ── Layout ─────────────────────────────────────────────────────────────────

const WIDTH = 800
const HEIGHT = 560

function runPackLayout(data: BubbleData) {
  const root = hierarchy<BubbleData>(data)
    .sum(d => (d.children ? 0 : d.importance))
    .sort((a, b) => (b.value || 0) - (a.value || 0))

  return pack<BubbleData>()
    .size([WIDTH, HEIGHT])
    .padding(d => {
      if (d.depth === 0) return 0
      if (d.depth === 1) return 18  // between categories
      return 6                       // between leaves inside a cluster
    })(root)
}
```

**Step 2: Add `ConnectionBubbles` component**

```typescript
// ── Component ──────────────────────────────────────────────────────────────

interface ConnectionBubblesProps {
  connections: Connection[]
}

export function ConnectionBubbles({ connections }: ConnectionBubblesProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)

  const packed = useMemo(() => {
    if (connections.length === 0) return null
    const data = buildHierarchy(connections)
    return runPackLayout(data)
  }, [connections])

  const handleCircleClick = useCallback((e: React.MouseEvent, node: HierarchyCircularNode<BubbleData>) => {
    e.stopPropagation()
    if (node.data.isCategory || node.data.isSubcategory) {
      setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(node.data.id)) next.delete(node.data.id)
        else next.add(node.data.id)
        return next
      })
      return
    }
    const { targetType, targetId } = node.data
    if (!targetType || !targetId) return
    if (targetType === 'artist') router.push(`/artist/${targetId}`)
    else if (targetType === 'recording') router.push(`/recording/${targetId}`)
  }, [router])

  if (!packed || connections.length === 0) {
    return (
      <div className="w-full h-[400px] rounded-xl border border-white/5 bg-[#0c0c10] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">No connections found.</p>
      </div>
    )
  }

  const allNodes = packed.descendants().slice(1) // exclude invisible root

  // Determine visible nodes based on expand state
  const visibleNodes = allNodes.filter(node => {
    const d = node.depth
    if (d === 1) return true  // category always visible
    const parentId = node.parent?.data.id
    if (!parentId) return false
    if (d === 2) return expanded.has(parentId)  // show when category expanded
    if (d === 3) {
      // Credits sub-leaf: show when Credits category AND parent subcategory both expanded
      const grandparentId = node.parent?.parent?.data.id
      return grandparentId
        ? expanded.has(grandparentId) && expanded.has(parentId)
        : expanded.has(parentId)
    }
    return false
  })

  return (
    <div
      className="w-full rounded-xl border border-white/5 overflow-hidden"
      style={{ background: '#0c0c10' }}
      onClick={() => { setExpanded(new Set()); setTooltip(null) }}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {visibleNodes.map(node => {
          const { id, name, color, bg, isCategory, isSubcategory, targetType, targetId } = node.data
          const isExpanded = expanded.has(id)
          const isLeaf = !isCategory && !isSubcategory
          const r = Math.max(node.r, 4)
          const fontSize = Math.min(13, Math.max(9, r * 0.28))
          const showText = r >= 22

          return (
            <g
              key={id}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
              onClick={(e) => handleCircleClick(e, node)}
              onMouseEnter={(e) => {
                if (r < 30) {
                  const svg = (e.currentTarget.closest('svg') as SVGSVGElement)
                  const rect = svg?.getBoundingClientRect()
                  const scale = rect ? WIDTH / rect.width : 1
                  setTooltip({ text: name, x: node.x, y: node.y - r - 8 })
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={r}
                fill={isExpanded ? `${bg.replace('0.18', '0.06').replace('0.10', '0.04')}` : bg}
                stroke={color}
                strokeWidth={isCategory ? 2 : 1}
                strokeOpacity={isExpanded ? 0.6 : 0.45}
              />
              {showText && (
                <text
                  x={node.x}
                  y={node.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isLeaf ? '#e5e5e5' : color}
                  fontSize={fontSize}
                  fontWeight={isCategory ? '700' : isSubcategory ? '600' : '400'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {name.length > Math.floor(r / 4) ? name.slice(0, Math.floor(r / 4)) + '…' : name}
                </text>
              )}
              {isCategory && !isExpanded && (
                <text
                  x={node.x}
                  y={node.y + fontSize * 1.2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={color}
                  fontSize={Math.max(8, fontSize * 0.75)}
                  opacity={0.6}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  tap to expand
                </text>
              )}
            </g>
          )
        })}

        {/* Tooltip for small nodes */}
        {tooltip && (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={tooltip.x - 60}
              y={tooltip.y - 18}
              width={120}
              height={24}
              rx={6}
              fill="rgba(18,18,24,0.95)"
              stroke="rgba(255,255,255,0.12)"
            />
            <text
              x={tooltip.x}
              y={tooltip.y - 6}
              textAnchor="middle"
              fill="#f5f5f5"
              fontSize={11}
            >
              {tooltip.text.length > 20 ? tooltip.text.slice(0, 18) + '…' : tooltip.text}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}
```

**Step 3: Verify TypeScript compiles**

```bash
pnpm --filter @soundgraph/web build 2>&1 | grep -E "error|Error" | head -10
```
Expected: no errors from `connection-bubbles.tsx`.

**Step 4: Commit**

```bash
git add apps/web/src/components/connection-bubbles.tsx
git commit -m "feat: add ConnectionBubbles SVG pack layout and rendering"
```

---

### Task 5: Replace `KnowledgeGraph` on recording page

**Files:**
- Modify: `apps/web/src/app/recording/[mbid]/page.tsx`

**Step 1: Swap import**

Find:
```typescript
import { KnowledgeGraph } from '@/components/knowledge-graph'
```
Replace with:
```typescript
import { ConnectionBubbles } from '@/components/connection-bubbles'
```

**Step 2: Update section (lines ~45–49)**

Find:
```tsx
{/* Mind Map — always visible, fixed height so page scrolls past it */}
<section>
  <h2 className="text-xl font-bold mb-3">Mind Map</h2>
  <KnowledgeGraph recording={recording} connections={connections} />
</section>
```

Replace with:
```tsx
{/* Connections */}
<section>
  <h2 className="text-xl font-bold mb-3">Connections</h2>
  <ConnectionBubbles connections={connections} />
</section>
```

**Step 3: Run dev server and visually verify**

```bash
pnpm dev
```

Open `http://localhost:3000` → search for a song with samples (e.g. "Hotline Bling", "Headlines") → open the recording page → verify the bubble chart renders with category clusters visible.

Expected:
- Dark background with 3–4 colored bubble clusters
- Samples From cluster (amber) visible if the song has samples
- Clicking a cluster expands to show child bubbles inside
- Double-tapping/clicking a leaf navigates to the artist/recording

**Step 4: Commit**

```bash
git add apps/web/src/app/recording/[mbid]/page.tsx
git commit -m "feat: replace mind map with ConnectionBubbles on recording page"
```

---

### Task 6: Replace `KnowledgeGraph` on artist page

**Files:**
- Modify: `apps/web/src/app/artist/[mbid]/page.tsx`

**Step 1: Swap import**

Find:
```typescript
import { KnowledgeGraph } from '@/components/knowledge-graph'
```
Replace with:
```typescript
import { ConnectionBubbles } from '@/components/connection-bubbles'
```

**Step 2: Update Connection Map section (lines ~332–376)**

Find the existing `KnowledgeGraph` usage inside the `{/* Connection Mind Map */}` section:
```tsx
<KnowledgeGraph
  recording={{ id: mbid, title: artist.name, spotifyData: heroImageUrl ? { album: { images: [{ url: heroImageUrl }] } } : undefined }}
  connections={[
    ...topCollaborators.slice(0, 8).map((a) => ({
      type: 'performer',
      label: `${a.count} collabs`,
      targetType: 'artist',
      targetId: a.mbid,
      targetName: a.name,
    })),
    ...topProducers.slice(0, 6).map((a) => ({
      type: 'producer',
      label: `${a.count} productions`,
      targetType: 'artist',
      targetId: a.mbid,
      targetName: a.name,
    })),
    ...samplesFrom.slice(0, 4).map((s) => ({
      type: 'samples material',
      label: 'samples',
      targetType: 'recording',
      targetId: s.rec_mbid,
      targetName: s.artist_name ? `${s.rec_title} (${s.artist_name})` : s.rec_title,
    })),
    ...sampledBy.slice(0, 4).map((s) => ({
      type: 'sampled by',
      label: 'sampled by',
      targetType: 'recording',
      targetId: s.rec_mbid,
      targetName: s.artist_name ? `${s.rec_title} (${s.artist_name})` : s.rec_title,
    })),
  ]}
/>
```

Replace with `ConnectionBubbles`, threading in `importance` from `count` / `popularity`:
```tsx
<ConnectionBubbles
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
      importance: (s as any).popularity || 1,
    })),
    ...sampledBy.slice(0, 4).map((s) => ({
      type: 'sampled by',
      label: 'sampled by',
      targetType: 'recording' as const,
      targetId: s.rec_mbid,
      targetName: s.artist_name ? `${s.rec_title} (${s.artist_name})` : s.rec_title,
      importance: (s as any).popularity || 1,
    })),
  ]}
/>
```

Also update the section heading:
```tsx
<h2 className="text-xl font-semibold mb-4">Connection Map</h2>
```
→
```tsx
<h2 className="text-xl font-semibold mb-4">Connections</h2>
```

**Step 3: Verify visually**

Open an artist page (e.g. `/artist/<drake-mbid>`) → verify the bubble chart renders with collaborator and sample clusters.

**Step 4: Commit**

```bash
git add apps/web/src/app/artist/[mbid]/page.tsx
git commit -m "feat: replace mind map with ConnectionBubbles on artist page"
```

---

### Task 7: Delete `KnowledgeGraph` and remove `@xyflow/react`

**Files:**
- Delete: `apps/web/src/components/knowledge-graph.tsx`
- Modify: `apps/web/package.json`

**Step 1: Verify no remaining imports of `knowledge-graph`**

```bash
grep -r "knowledge-graph\|KnowledgeGraph" apps/web/src --include="*.tsx" --include="*.ts"
```
Expected: no output (all usages replaced in Tasks 5 and 6).

**Step 2: Delete the file**

```bash
rm apps/web/src/components/knowledge-graph.tsx
```

**Step 3: Remove `@xyflow/react` dependency**

```bash
pnpm --filter @soundgraph/web remove @xyflow/react
```

**Step 4: Verify build**

```bash
pnpm --filter @soundgraph/web build 2>&1 | tail -20
```
Expected: build succeeds, no `@xyflow/react` import errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove KnowledgeGraph and @xyflow/react dependency"
```

---

### Task 8: Visual QA pass

No code changes — verification only.

**Step 1: Check recording page with a well-sampled track**

Find a recording with samples + credits + performers. Good test cases:
- Search "Ex-Factor" (Lauryn Hill) — sampled many times
- Search "Amen Brother" (Winstons) — most sampled break in history

Expected on recording page:
- "Samples From" cluster (amber) appears and is proportionally sized
- "Sampled By" cluster (blue-gray) if present
- "Credits" cluster (stone) with sub-expansion working
- Clicking "Credits" → shows "Producers", "Engineers & Mix" sub-bubbles inside
- Clicking a leaf node → tooltip, then click again → navigates to artist page

**Step 2: Check artist page**

Open any artist with collaborators and sample data. Expected:
- Collaborators (performers) cluster
- Producers cluster
- Samples From / Sampled By clusters if data exists
- Sizes reflect `count` importance (prolific collaborators = bigger bubble)

**Step 3: Check edge case — recording with zero connections**

Find a recording with no credits/samples in DB (any obscure recording). Expected:
- Shows "No connections found." message, no crash.

**Step 4: Commit any fixes found**

```bash
git add -A
git commit -m "fix: ConnectionBubbles visual QA adjustments"
```
