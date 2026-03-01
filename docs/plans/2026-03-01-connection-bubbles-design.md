# Connection Bubbles Design

**Date:** 2026-03-01
**Status:** Approved

## Problem

The current mind map (`KnowledgeGraph` / React Flow) is not usable:
- Nodes scatter across empty canvas with no visual hierarchy
- Groups collapse to unreadable "+N" labels
- No sense of importance — every node looks the same
- Pan/zoom required to read anything

## Goal

Replace the mind map with a spatial bubble chart (`ConnectionBubbles`) that makes sample relationships the visual focus, sizes nodes by importance, and works at song, album, and artist level.

---

## Architecture

New component `ConnectionBubbles` replaces `KnowledgeGraph` everywhere it's used (recording page, artist page). `knowledge-graph.tsx` and its React Flow dependency are deleted.

**Three-level d3-pack hierarchy:**
1. **Root** — invisible container
2. **Category clusters** — Samples From, Sampled By, Credits, Performers (+ Collaborators/Producers on artist page). Radius = proportional to sum of children's importance scores.
3. **Leaf nodes** — individual artists or recordings. Radius = proportional to individual importance score.

**Credits get one extra level**: clicking Credits reveals sub-clusters (Producers, Engineers/Mix, Performers), then clicking a sub-cluster reveals individual artists. This maps to: artist → producer → instrument → mix → engineer → audio.

Rendered as SVG. `d3.pack()` outputs `x/y/r` for every circle; React renders `<circle>` + `<text>` elements. No canvas, no React Flow.

---

## Importance Score

**Composite score** = `Spotify popularity × 0.6 + DB popularity (log-normalized 0–100) × 0.4`

- **Spotify popularity** (0–100, stream-based): fetched from `ApiCache` via LEFT JOIN — no extra API calls, uses already-cached data. Handles current hits.
- **DB popularity** (credit count + tag count, log-normalized): already on every `Artist` and `Recording` row. Handles historical classics.
- **Fallback**: if no Spotify cache, DB score alone.

This ensures both "Ex-Factor" (Lauryn Hill, high DB credits) and "Hotline Bling" (Drake, high Spotify) rank appropriately.

---

## Visual Design

| Element | Style |
|---------|-------|
| Background | `#0c0c10` (same as current) |
| Samples cluster | Amber `#c4956a` |
| Credits cluster | Stone `#d6d3d1` |
| Performers cluster | Slate `#a3a3a3` |
| Sampled By cluster | Blue-gray `#8b9cc4` |
| Leaf nodes | Same color at 15% opacity fill, colored border |
| Text | White, center-aligned, truncated |

**Text rules:**
- `r >= 45px` → show full name (truncated with ellipsis)
- `r < 45px` → no text, show tooltip on hover
- `r < 25px` → render as dot only

**Layout anchor:** Samples cluster always anchored top-center — first thing the eye lands on.

**Overflow:** clusters with >12 leaf nodes show a "+N more" bubble at the edge of the cluster. Clicking it expands all.

---

## Interactions

| Action | Result |
|--------|--------|
| Click category cluster | Expands in place — child bubbles animate outward. Other clusters gently repack. |
| Click Credits cluster | Shows sub-clusters first (Producers, Engineers, Mix), then expand each. |
| Click expanded cluster | Collapses back. |
| Click background | Collapses all expanded clusters. |
| Single-click leaf node | Shows tooltip: name + role. |
| Double-click leaf node | Navigates to `/artist/:mbid` or `/recording/:mbid`. |
| Hover small bubble (r < 45px) | Tooltip with full name. |

---

## Multi-Level Support

Same `ConnectionBubbles` component, different data:

| Page | Clusters shown |
|------|---------------|
| Song (`/recording/[mbid]`) | Samples From, Sampled By, Credits, Performers |
| Artist (`/artist/[mbid]`) | Collaborators, Producers, Sampled From, Sampled By |
| Album (`/release-group/[id]`) | Tracks (sized by popularity), Credits (rolled up across all recordings) |
| Genre | Future — no data source yet |

---

## Data Layer Changes

**`data-service.ts`:**
- `getRecordingConnections`: add `importance` field to each connection — join `Artist.popularity` for artist nodes, `Recording.popularity` for sample nodes, LEFT JOIN `ApiCache` to blend in Spotify score where cached.
- `getArtistConnections`: add `importance` field using `count` for collaborators/producers, `popularity` for sample recordings, blended with Spotify cache where available.

**`Connection` interface** gains `importance?: number`.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/components/knowledge-graph.tsx` | **Delete** |
| `apps/web/src/components/connection-bubbles.tsx` | **Create** — d3-pack SVG bubble chart |
| `apps/web/src/lib/data-service.ts` | Add `importance` to connection objects (blended score) |
| `apps/web/src/app/recording/[mbid]/page.tsx` | Replace `KnowledgeGraph` with `ConnectionBubbles` |
| `apps/web/src/app/artist/[mbid]/page.tsx` | Replace `KnowledgeGraph` with `ConnectionBubbles` |
| `apps/web/package.json` | Remove `@xyflow/react`; add `d3-hierarchy` |

---

## Non-Goals

- No genre page (no data source)
- No live animation (layout computed once, transitions on expand/collapse only)
- No mobile-specific layout (responsive SVG viewBox handles it)
- No changes to search, header, or other pages
