# Knowledge Graph: Force Layout + Variable Node Sizing

**Date:** 2026-03-01
**Status:** Approved

## Problem

The current concentric ring layout in `knowledge-graph.tsx` has two legibility issues:
1. All nodes are the same size — no visual hierarchy signals importance
2. Static ring math can produce overlapping nodes when a group has many members

## Goal

Make sample relationships the visual focus. Use d3-force to compute a non-overlapping layout once at render time (no animation). Node sizes reflect importance.

---

## Design

### 1. Data layer — add `importance` to connections

**File:** `apps/web/src/lib/data-service.ts`

Add `importance?: number` to the `Connection` type used by `getRecordingConnections`:
- Artist credits: join `Artist.popularity` alongside each credit row
- Sample recordings: select `sampledTrack.popularity` / `samplingTrack.popularity`

For `getArtistConnections`, map the existing `count` field to `importance` in the returned connection objects.

### 2. Node sizing — log scale, samples boosted

**File:** `apps/web/src/components/knowledge-graph.tsx`

```
size = baseSize + range * (log(1 + importance) / log(1 + maxImportance))
```

| Node type    | Min size | Max size | Notes |
|------------- |--------- |--------- |-------|
| Center       | 180px    | 180px    | unchanged |
| Sample       | 80px     | 130px    | higher floor — samples are always prominent |
| Artist/other | 55px     | 110px    | standard range |

Node shape: samples stay rounded-rectangle; artists stay circular.

### 3. d3-force simulation — runs once, no animation

**Package:** `d3-force` (install in `@soundgraph/web`)

Forces applied:
| Force | Config | Purpose |
|-------|--------|---------|
| `forceCenter(0, 0)` | default | keep cluster centered |
| `forceManyBody` | strength = `-(nodeSize * 4)` | larger nodes push more |
| `forceLink` | distance varies by type (see below) | pull nodes toward center |
| `forceCollide` | radius = `nodeSize/2 + 20` | no overlap |

**Link distances by connection type:**
- `samples material` / `sample` / `sampled by`: **180px** — samples cluster close to center
- `producer` / `composer` / engineer credits: **320px**
- `performer` / vocal / instrument: **420px**
- everything else: **350px**

Run **300 ticks** synchronously. On a graph with ~30 nodes this takes <2ms.

Initialize node positions at their existing ring layout positions (warm start — converges faster and avoids chaotic initial layout).

### 4. Visual changes

- **Remove ring guide circles** — they'd be misleading after force repositions nodes
- Keep all existing colors, edge styles, edge animations
- Keep group labels — reposition them at the centroid of their node cluster after simulation
- Keep popover on single-click, navigate on double-click

---

## Files changed

| File | Change |
|------|--------|
| `apps/web/src/lib/data-service.ts` | Add `importance` field to connection objects in `getRecordingConnections` and `getArtistConnections` |
| `apps/web/src/components/knowledge-graph.tsx` | Add `importance` to `Connection` interface; replace ring layout with d3-force; variable node sizing |
| `apps/web/package.json` | Add `d3-force` dependency |

---

## Non-goals

- No live animation (layout computed once, nodes appear settled)
- No changes to edge routing or popover behavior
- No changes to search or other pages
