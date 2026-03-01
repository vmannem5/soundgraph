# SoundGraph Frontend Redesign

**Date:** 2026-03-01
**Approach:** Visual Overhaul (B) with Graph-First Elements (C)
**Goal:** Replace generic AI-look with a distinctive music platform identity — editorial Apple Music feel, Discogs density, graph-focused navigation.

## Three Problems to Solve

1. Frontend looks sterile/generic — no music identity, too much whitespace, no personality
2. Search/sort/ranking not smooth, many results lack images
3. Mind map tab scroll is broken (React Flow eats scroll events)

---

## 1. Home Page — Graph Discovery

**Current:** Empty page with centered search bar.

**New:**
- Full-width search bar at top (glass/blur effect)
- Hero area: animated, interactive mini-graph (~20-30 nodes) showing the most-connected recordings and artists
  - Nodes are album art circles, sized by connection count
  - Edges colored by relationship type (warm = samples, cool = credits)
  - Gentle drift animation on idle, hover reveals tooltip, click navigates to detail page
  - Uses React Flow or d3-force for layout
- Below graph: 2-3 editorial rows
  - "Most Sampled Recordings" — horizontal scroll of album art cards with sample count badges
  - "Top Producers" — horizontal scroll of producer avatars with credit counts
- Mobile: graph collapses to editorial rows only

---

## 2. Search Experience

**Dropdown results:**
- As-you-type results appear in a dropdown overlay (no page navigation)
- Enter or "See all" navigates to full results page

**Full results page:**
- Artists: grid of square cards (3-4/row desktop). Large image/avatar fills card, name overlaid with gradient fade
- Recordings: grid of rectangular cards. Album art left, title + artist bold right, genre badges, connection count
- Sortable client-side: Popularity (default), Most Connected, Name A-Z
- Animated card transitions on sort change

**Generated avatars (for missing images):**
- Deterministic from MBID hash
- Abstract geometric patterns (overlapping circles, intersecting lines, gradients)
- Color palette from genre tags (jazz = amber/brown, electronic = cyan/purple, hip-hop = red/orange)
- Rendered as SVG, unique per entity

---

## 3. Recording Page — Editorial + Immersive Mind Map

**Hero section:**
- Full-width gradient banner from album art dominant color
- Large album art, bold title, clickable artist name
- Compact Spotify player strip integrated into hero
- Key stats as badges: credit count, sample count, release year

**Mind map (primary content, NOT tabbed):**
- Below hero, occupies ~70vh with fixed height container (`overflow: hidden`)
- Page scroll works normally above and below
- Nodes show album art thumbnails, artist nodes show avatars
- Center node has glowing ring effect
- Edges colored and labeled by relationship type
- **Inline expansion:** clicking a node shows a mini-card with details and further connections (no navigation). Double-click navigates.

**Below mind map:**
- Credits, Performers, Samples as compact scrollable sections (no tabs)
- Each section: grid of small avatar+name cards grouped by role
- All visible on one scrollable page

### Scroll fix:
React Flow container gets fixed height, `overflow: hidden`. No `zoomOnScroll` or `preventScrolling` issues — graph interaction is drag/pan/pinch only within its container.

---

## 4. Artist Page

**Hero section:**
- Full-width gradient banner from artist image
- Large circular image/avatar, bold name, genre pills, follower count, country/lifespan

**Discography:**
- Visual grid of album art cards (not list)
- Each card: art, title, year, type badge
- Hover reveals tracklist preview

**Connections section (graph-first element):**
- Mini knowledge graph showing this artist's notable connections
- Collaborators, producers, sample chains
- Same React Flow component, scoped to artist network

---

## 5. Design System

**Typography:**
- Headings: Space Grotesk or Outfit (geometric, modern)
- Body: Inter (clean, dense readability)
- Larger heading sizes, bolder weights

**Color:**
- Dark base: deep charcoal (not pure black), subtle warmth
- Primary accent: warm amber/gold
- Secondary accent: cool blue
- Dynamic accents extracted from album art where available
- "Vinyl warmth meets digital cool" duality

**Spacing:**
- Tighter padding, smaller gaps, higher information density
- More content visible per screen

**Animations:**
- Subtle fade-in on route change
- Card hover: slight scale + shadow lift
- Graph nodes: gentle breathing on idle

**Generated avatar system:**
- Input: MBID hash → deterministic seed
- Output: unique SVG geometric pattern (circles, arcs, lines)
- Colors from genre tags or name hash
- Same MBID always produces same avatar
