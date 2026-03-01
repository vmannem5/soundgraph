# GENUS Design

**Date:** 2026-03-01
**Status:** Approved

---

## Goal

GENUS is a separate brand/product that treats music like a scientific archive — every song is a *Specimen* classified within a *Lineage* (taxonomy tree), described by a *Sound Profile* (radar chart of 6 measurable axes), and situated within *Origins* (era, geography, influences). SoundGraph becomes the prototype; GENUS is the polished product.

---

## Section 1: Product Concept

GENUS reframes music discovery around classification and sonic DNA rather than popularity. Instead of "similar artists", users see "Shared Lineage." Instead of genre tags, they see a hierarchical Sound Family tree.

**Vocabulary (music-adjacent, not biological):**

| GENUS term | Maps to | Scope |
|---|---|---|
| Sound Family | Super-genre | e.g. "Hip-Hop" |
| Movement | Sub-genre cluster | e.g. "Boom Bap" |
| Scene | Regional/era variant | e.g. "East Coast Golden Age" |
| Sound | Specific style | e.g. "Jazz Rap" |
| Strain | Micro-variation | e.g. "Conscious Lyricism" |
| Specimen | Individual artist or recording | Drake, "C.R.E.A.M." |
| Lineage | The full classification path | Sound Family → Strain |
| Sound Profile | Radar chart of 6 sonic axes | Genre breadth, era spread, etc. |
| Origins | Era + geography + key influences | |

---

## Section 2: Homepage

- **Search bar** — full-text search across Specimens (artists + recordings) and Sound Families
- **6 featured Sound Family tiles** — curated grid showing top Sound Families (Hip-Hop, Rock, Jazz, Electronic, R&B, Soul) with specimen count
- **Featured Specimens strip** — 4–5 hand-curated artist or recording tiles with their Lineage path shown beneath name

---

## Section 3: Specimen Page

Three-column layout (collapses to stacked on mobile):

**Left: Classification panel**
- Lineage breadcrumb: Sound Family → Movement → Scene → Sound → Strain
- Each level clickable (navigates to taxonomy browser at that level)

**Center: Sound Profile radar chart**
Six axes (all computable from existing DB):
1. **Genre breadth** — count of distinct tags (ArtistTag/RecordingTag)
2. **Sample use** — outgoing SampleRelation count (samples others)
3. **Collaboration radius** — unique co-credited artists (Credit table)
4. **Era spread** — year range of releases (ReleaseGroup.firstReleaseDate)
5. **Instrument diversity** — count of distinct instrument-type Credits
6. **Geographic reach** — count of distinct countries (Release.country)

Values normalized 0–100 within each axis.

**Right: Origins & Traits panel**
- Era (year range of releases)
- Geography (artist country, primary release markets)
- Key Influences — other Specimens this artist samples or credits heavily
- Sound Signature — top 3 tags

**Below (full width): Lineage tree**
- Shows the classification tree rooted at Sound Family, with this Specimen highlighted
- Lists 3–5 "Related Specimens" (same Sound + Strain classification)

---

## Section 4: Taxonomy Browser

- Start at Sound Family level — 6 tiles
- Click → expands to Movements within that Sound Family
- Click a Movement → expands to Scenes, then Sounds, then Strains
- Each level shows specimen count and 2–3 featured Specimen tiles
- Breadcrumb navigation

---

## Section 5: Data Model

New tables in the shared PostgreSQL DB:

```sql
-- Self-referential taxonomy tree
CREATE TABLE "GenreTaxonomy" (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  level       TEXT NOT NULL CHECK (level IN ('family','movement','scene','sound','strain')),
  parentId    INTEGER REFERENCES "GenreTaxonomy"(id),
  description TEXT,
  specimenCount INTEGER DEFAULT 0
);

-- Links Artist/Recording to taxonomy nodes
CREATE TABLE "SpecimenClassification" (
  id              SERIAL PRIMARY KEY,
  entityType      TEXT NOT NULL CHECK (entityType IN ('artist','recording')),
  entityMbid      TEXT NOT NULL,
  taxonomyId      INTEGER NOT NULL REFERENCES "GenreTaxonomy"(id),
  confidence      FLOAT DEFAULT 1.0
);

-- Pre-computed radar values (one row per specimen)
CREATE TABLE "SoundProfile" (
  id                  SERIAL PRIMARY KEY,
  entityType          TEXT NOT NULL,
  entityMbid          TEXT NOT NULL UNIQUE,
  genreBreadth        FLOAT DEFAULT 0,
  sampleUse           FLOAT DEFAULT 0,
  collaborationRadius FLOAT DEFAULT 0,
  eraSpread           FLOAT DEFAULT 0,
  instrumentDiversity FLOAT DEFAULT 0,
  geographicReach     FLOAT DEFAULT 0
);
```

---

## Section 6: Build Approach

- **New `apps/genus/` in monorepo** (Next.js 15 App Router, same setup as `apps/web/`)
- Shares `packages/database/` Prisma client — only new tables need schema additions
- Own domain (separate from SoundGraph)
- Initially read-only seeded data (no user accounts)
- **MVP scope:**
  1. DB schema additions (3 tables)
  2. Seeding script — populate GenreTaxonomy with top 6 Sound Families, map artists via existing ArtistTag data
  3. Compute SoundProfile for seeded artists
  4. `apps/genus/` Next.js app — homepage, specimen page, taxonomy browser
  5. Shared Prisma client (no new packages needed)

---

## Success Criteria

- Taxonomy browser loads top 6 Sound Families, each with at least 10 specimens
- Specimen page for a major artist (e.g. Drake, Miles Davis) shows all 6 radar axes
- Lineage breadcrumb links to taxonomy browser at correct level
- Sound Profile radar chart renders as SVG (no new chart library — pure SVG like ConnectionBubbles)
- Search returns Specimen results with Lineage path shown in results

---

## Deferred

- User accounts / collections
- Edit/curate taxonomy
- Audio features (Spotify API deprecated)
- Recording specimen pages (MVP is artist-only)
- Infinite scroll taxonomy browser

---

*Brainstormed and approved 2026-03-01. User preference: Approach B+C (Taxonomy Browser + Sound DNA Profiler). Music-adjacent vocabulary, not literal biological terms.*
