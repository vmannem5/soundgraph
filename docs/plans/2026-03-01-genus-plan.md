# GENUS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build GENUS — a separate Next.js app in the monorepo that classifies artists into a Sound Family taxonomy tree and shows a Sound Profile radar chart for each Specimen (artist).

**Architecture:** New `apps/genus/` Next.js 15 app shares the `packages/database/` Prisma client. Three new tables are added to the existing PostgreSQL schema: `GenreTaxonomy` (self-referential hierarchy), `SpecimenClassification` (entity→taxonomy), `SoundProfile` (pre-computed radar values). A seeding script populates the taxonomy from existing `ArtistTag` data and computes Sound Profiles. The app has three pages: homepage, specimen page, taxonomy browser.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, TypeScript, Prisma 5.22.0 (shared), PostgreSQL 16, `@soundgraph/database` workspace package, pure SVG radar chart (no new chart libraries), no test framework (manual verification via `pnpm build`).

**Important monorepo facts (read before coding):**
- Run commands from `/Users/vmannem/soundgraph` (monorepo root) unless noted
- `pnpm --filter @soundgraph/genus dev` starts the genus dev server
- `pnpm --filter @soundgraph/database db:push` applies schema changes
- Always use `npx prisma` (v5.22.0 local), never `pnpm dlx prisma` (pulls v7)
- `packages/database/prisma/schema.prisma` is the single source of truth for all DB tables
- After schema changes: `pnpm --filter @soundgraph/database db:push` then `pnpm --filter @soundgraph/database db:generate`
- Tailwind CSS v4 syntax: `@import "tailwindcss"` (NOT `@tailwind base/components/utilities`)
- Dark theme: add `.dark` class to `<html>` element (matches SoundGraph pattern)

---

## Task 1: DB schema — add 3 GENUS tables

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (append after `ApiCache` model at line ~210)

**Step 1: Append the 3 new models to schema.prisma**

Add exactly this at the end of `packages/database/prisma/schema.prisma`:

```prisma
// === GENUS: Sound Taxonomy ===

model GenreTaxonomy {
  id            Int     @id @default(autoincrement())
  name          String
  slug          String  @unique
  level         String  // family | movement | scene | sound | strain
  parentId      Int?
  description   String?
  specimenCount Int     @default(0)

  parent        GenreTaxonomy?  @relation("TaxonomyTree", fields: [parentId], references: [id])
  children      GenreTaxonomy[] @relation("TaxonomyTree")
  classifications SpecimenClassification[]

  @@index([slug])
  @@index([parentId])
  @@index([level])
}

model SpecimenClassification {
  id          Int    @id @default(autoincrement())
  entityType  String // "artist" | "recording"
  entityMbid  String
  taxonomyId  Int
  confidence  Float  @default(1.0)

  taxonomy    GenreTaxonomy @relation(fields: [taxonomyId], references: [id])

  @@unique([entityType, entityMbid, taxonomyId])
  @@index([entityMbid])
  @@index([taxonomyId])
}

model SoundProfile {
  id                  Int    @id @default(autoincrement())
  entityType          String // "artist"
  entityMbid          String @unique
  genreBreadth        Float  @default(0)
  sampleUse           Float  @default(0)
  collaborationRadius Float  @default(0)
  eraSpread           Float  @default(0)
  instrumentDiversity Float  @default(0)
  geographicReach     Float  @default(0)

  @@index([entityType])
}
```

**Step 2: Push schema to local DB**

```bash
cd /Users/vmannem/soundgraph
pnpm --filter @soundgraph/database db:push
```

Expected output: `Your database is now in sync with your Prisma schema.`

**Step 3: Regenerate Prisma client**

```bash
pnpm --filter @soundgraph/database db:generate
```

Expected: No errors, generates updated client.

**Step 4: Verify tables exist**

```bash
/opt/homebrew/opt/postgresql@16/bin/psql -U vmannem -d soundgraph_import -c "\dt" | grep -E "GenreTaxonomy|SpecimenClassification|SoundProfile"
```

Expected: 3 rows matching.

**Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(db): add GenreTaxonomy, SpecimenClassification, SoundProfile tables"
```

---

## Task 2: Seeding script — populate taxonomy + classify artists

**Files:**
- Create: `scripts/seed-genus.ts`

No test framework — verification is running the script and checking DB row counts.

**Step 1: Create the seed script**

Create `scripts/seed-genus.ts`:

```typescript
/**
 * Seed GENUS taxonomy from existing ArtistTag data.
 *
 * What this does:
 * 1. Creates 6 Sound Families (top-level taxonomy nodes)
 * 2. Maps existing ArtistTag entries to Sound Families by tag name
 * 3. Inserts SpecimenClassification rows linking Artist.mbid → taxonomy node
 * 4. Computes SoundProfile for each classified artist
 *
 * Run: npx ts-node --project tsconfig.json scripts/seed-genus.ts
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
  const familyMap = new Map<string, number>() // slug → id
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
    const artists = await prisma.$queryRaw<Array<{ mbid: string }>>`
      SELECT DISTINCT a.mbid
      FROM "Artist" a
      JOIN "ArtistTag" at ON at."artistId" = a.id
      WHERE LOWER(at.tag) = ANY(${fam.tags})
      LIMIT 500
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

    // Update specimenCount on the taxonomy node
    await prisma.genreTaxonomy.update({
      where: { id: taxonomyId },
      data: { specimenCount: classifiedInFamily },
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

  // Compute in batches of 100 to avoid memory issues
  const BATCH = 100
  for (let i = 0; i < classifiedArtists.length; i += BATCH) {
    const batch = classifiedArtists.slice(i, i + BATCH)
    const mbids = batch.map(a => a.entityMbid)

    // Raw query to compute all 6 axes at once
    const profiles = await prisma.$queryRaw<Array<{
      mbid: string
      genre_breadth: number
      sample_use: number
      collab_radius: number
      era_spread: number
      instrument_diversity: number
      geo_reach: number
    }>>`
      SELECT
        a.mbid,
        COUNT(DISTINCT at.tag)::float        AS genre_breadth,
        COUNT(DISTINCT sr.id)::float         AS sample_use,
        COUNT(DISTINCT c."artistId")::float  AS collab_radius,
        COALESCE(
          MAX(EXTRACT(YEAR FROM rg."firstReleaseDate"::date)) -
          MIN(EXTRACT(YEAR FROM rg."firstReleaseDate"::date)),
          0
        )::float                             AS era_spread,
        COUNT(DISTINCT c.instrument)::float  AS instrument_diversity,
        COUNT(DISTINCT rel.country)::float   AS geo_reach
      FROM "Artist" a
      LEFT JOIN "ArtistTag" at ON at."artistId" = a.id
      LEFT JOIN "Credit" c2 ON c2."artistId" = a.id
      LEFT JOIN "Recording" rec ON rec.id = c2."recordingId"
      LEFT JOIN "SampleRelation" sr ON sr."samplingTrackId" = rec.id
      LEFT JOIN "Credit" c ON c."recordingId" = rec.id AND c."artistId" != a.id
      LEFT JOIN "ReleaseRecording" rr ON rr."recordingId" = rec.id
      LEFT JOIN "Release" rel ON rel.id = rr."releaseId"
      LEFT JOIN "ReleaseGroup" rg ON rg.id = rel."releaseGroupId"
        AND rg."firstReleaseDate" IS NOT NULL
        AND rg."firstReleaseDate" != ''
      WHERE a.mbid = ANY(${mbids})
      GROUP BY a.mbid
    `

    // Normalize each axis to 0-100 within this batch
    const normalize = (arr: number[]) => {
      const max = Math.max(...arr, 1)
      return arr.map(v => Math.min(100, (v / max) * 100))
    }

    const genreBreadths = normalize(profiles.map(p => Number(p.genre_breadth)))
    const sampleUses = normalize(profiles.map(p => Number(p.sample_use)))
    const collabRadii = normalize(profiles.map(p => Number(p.collab_radius)))
    const eraSpreads = normalize(profiles.map(p => Number(p.era_spread)))
    const instrDiversities = normalize(profiles.map(p => Number(p.instrument_diversity)))
    const geoReaches = normalize(profiles.map(p => Number(p.geo_reach)))

    for (let j = 0; j < profiles.length; j++) {
      const p = profiles[j]
      await prisma.soundProfile.upsert({
        where: { entityMbid: p.mbid },
        create: {
          entityType: 'artist',
          entityMbid: p.mbid,
          genreBreadth: genreBreadths[j],
          sampleUse: sampleUses[j],
          collaborationRadius: collabRadii[j],
          eraSpread: eraSpreads[j],
          instrumentDiversity: instrDiversities[j],
          geographicReach: geoReaches[j],
        },
        update: {
          genreBreadth: genreBreadths[j],
          sampleUse: sampleUses[j],
          collaborationRadius: collabRadii[j],
          eraSpread: eraSpreads[j],
          instrumentDiversity: instrDiversities[j],
          geographicReach: geoReaches[j],
        },
      })
    }

    if ((i / BATCH) % 5 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH, classifiedArtists.length)} / ${classifiedArtists.length}`)
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
```

**Step 2: Run the seed script**

```bash
cd /Users/vmannem/soundgraph
npx ts-node --project tsconfig.json scripts/seed-genus.ts
```

Expected output:
```
Seeding GENUS taxonomy...
  Upserted Sound Family: Hip-Hop (id=1)
  Upserted Sound Family: Rock (id=2)
  ...
  Hip-Hop: classified NNN artists
  ...
Computing Sound Profiles...
  Computing profiles for NNN artists...
Done! Summary:
  GenreTaxonomy (family) rows: 6
  SpecimenClassification rows: NNN
  SoundProfile rows: NNN
```

If `npx ts-node` fails, try: `npx tsx scripts/seed-genus.ts`

**Step 3: Verify counts**

```bash
/opt/homebrew/opt/postgresql@16/bin/psql -U vmannem -d soundgraph_import -c \
  "SELECT level, count(*) FROM \"GenreTaxonomy\" GROUP BY level; SELECT count(*) FROM \"SpecimenClassification\"; SELECT count(*) FROM \"SoundProfile\";"
```

Expected: 6 family rows, >100 classifications, >100 profiles.

**Step 4: Commit**

```bash
git add scripts/seed-genus.ts
git commit -m "feat(scripts): add seed-genus script for taxonomy + sound profiles"
```

---

## Task 3: Create `apps/genus/` Next.js app scaffold

**Files:**
- Create: `apps/genus/package.json`
- Create: `apps/genus/next.config.ts`
- Create: `apps/genus/tsconfig.json`
- Create: `apps/genus/src/app/layout.tsx`
- Create: `apps/genus/src/app/globals.css`
- Create: `apps/genus/src/app/page.tsx` (placeholder)

**Step 1: Create `apps/genus/package.json`**

```json
{
  "name": "@soundgraph/genus",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "eslint"
  },
  "dependencies": {
    "@soundgraph/database": "workspace:*",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.575.0",
    "next": "15.5.12",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "15.5.12",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

**Step 2: Create `apps/genus/next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@soundgraph/database"],
};

export default nextConfig;
```

**Step 3: Create `apps/genus/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 4: Create `apps/genus/src/app/globals.css`**

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --border: oklch(0.922 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --genus-gold: oklch(78% 0.15 85);
  --genus-gold-muted: oklch(78% 0.08 85);
}

.dark {
  --background: oklch(0.08 0.005 265);
  --foreground: oklch(0.95 0 0);
  --muted: oklch(0.135 0.005 265);
  --muted-foreground: oklch(0.6 0.005 265);
  --border: oklch(0.22 0.005 265);
  --accent: oklch(0.135 0.005 265);
  --accent-foreground: oklch(0.95 0 0);
  --primary: oklch(0.95 0 0);
  --primary-foreground: oklch(0.08 0.005 265);
  --card: oklch(0.1 0.005 265);
  --card-foreground: oklch(0.95 0 0);
  --genus-gold: oklch(78% 0.18 85);
  --genus-gold-muted: oklch(78% 0.08 85);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --font-sans: var(--font-inter);
}

* { box-sizing: border-box; }

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans, system-ui), sans-serif;
  min-height: 100vh;
}
```

**Step 5: Create `apps/genus/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "GENUS",
  description: "Classify music. Trace lineage. Read the sound.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <header className="border-b border-border px-6 py-4 flex items-center gap-3">
          <span className="text-xl font-bold tracking-wider" style={{ color: 'var(--genus-gold)' }}>
            GENUS
          </span>
          <span className="text-xs text-muted-foreground font-mono tracking-widest uppercase">
            Sound Classification
          </span>
        </header>
        {children}
      </body>
    </html>
  );
}
```

**Step 6: Create placeholder `apps/genus/src/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 text-center">
      <h1 className="text-5xl font-bold mb-4" style={{ color: 'var(--genus-gold)' }}>
        GENUS
      </h1>
      <p className="text-muted-foreground text-lg">
        Sound Classification System — coming soon
      </p>
    </main>
  );
}
```

**Step 7: Install dependencies**

```bash
cd /Users/vmannem/soundgraph
pnpm install
```

**Step 8: Verify the app builds**

```bash
pnpm --filter @soundgraph/genus build
```

Expected: Build succeeds with no errors.

**Step 9: Commit**

```bash
git add apps/genus/
git commit -m "feat(genus): scaffold Next.js app with dark theme + GENUS branding"
```

---

## Task 4: GENUS data-service.ts

**Files:**
- Create: `apps/genus/src/lib/data-service.ts`
- Create: `apps/genus/src/lib/utils.ts`

**Step 1: Create `apps/genus/src/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 2: Create `apps/genus/src/lib/data-service.ts`**

```typescript
import { prisma } from '@soundgraph/database'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TaxonomyNode {
  id: number
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
  primaryFamily: string | null
  primaryFamilySlug: string | null
  lineage: string[]  // [family, movement?, scene?, sound?, strain?]
}

export interface SpecimenDetail extends SpecimenSummary {
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
    taxonomyId: number
    name: string
    slug: string
    level: string
  }>
  relatedSpecimens: SpecimenSummary[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildLineage(node: { name: string; parent?: { name: string; parent?: unknown } | null }): string[] {
  const path: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = node
  while (current) {
    path.unshift(current.name)
    current = current.parent
  }
  return path
}

// ── Queries ────────────────────────────────────────────────────────────────

/** All top-level Sound Families with direct child count */
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
  return families.map(mapNode)
}

/** Taxonomy node by slug with ancestors (for breadcrumb) */
export async function getTaxonomyNode(slug: string) {
  return prisma.genreTaxonomy.findUnique({
    where: { slug },
    include: {
      parent: { include: { parent: { include: { parent: true } } } },
      children: { orderBy: { specimenCount: 'desc' } },
    },
  }).catch(() => null)
}

/** Artist specimen detail */
export async function getSpecimenDetail(mbid: string): Promise<SpecimenDetail | null> {
  const artist = await prisma.artist.findUnique({
    where: { mbid },
    include: {
      tags: { orderBy: { count: 'desc' }, take: 10 },
    },
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

    // Related specimens — share at least one taxonomy node, ordered by specimen count
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

  // Primary family = the family-level classification (first one)
  const familyClassification = classifications.find(c => c.taxonomy.level === 'family')
  const primaryFamily = familyClassification?.taxonomy.name ?? null
  const primaryFamilySlug = familyClassification?.taxonomy.slug ?? null

  // Lineage from deepest classification
  const deepest = classifications.sort((a, b) => {
    const order = { family: 0, movement: 1, scene: 2, sound: 3, strain: 4 }
    return (order[b.taxonomy.level as keyof typeof order] || 0) - (order[a.taxonomy.level as keyof typeof order] || 0)
  })[0]
  const lineage = deepest ? buildLineage(deepest.taxonomy as Parameters<typeof buildLineage>[0]) : []

  const relatedSpecimens: SpecimenSummary[] = relatedRaw.map(r => ({
    mbid: r.mbid,
    name: r.name,
    country: r.country,
    type: r.type,
    primaryFamily,
    primaryFamilySlug,
    lineage,
  }))

  return {
    mbid: artist.mbid,
    name: artist.name,
    country: artist.country,
    type: artist.type,
    primaryFamily,
    primaryFamilySlug,
    lineage,
    tags: artist.tags.map(t => ({ tag: t.tag, count: t.count })),
    soundProfile: soundProfile
      ? {
          genreBreadth: soundProfile.genreBreadth,
          sampleUse: soundProfile.sampleUse,
          collaborationRadius: soundProfile.collaborationRadius,
          eraSpread: soundProfile.eraSpread,
          instrumentDiversity: soundProfile.instrumentDiversity,
          geographicReach: soundProfile.geographicReach,
        }
      : null,
    classifications: classifications.map(c => ({
      taxonomyId: c.taxonomyId,
      name: c.taxonomy.name,
      slug: c.taxonomy.slug,
      level: c.taxonomy.level,
    })),
    relatedSpecimens,
  }
}

/** Search artists by name, returns those with classifications */
export async function searchSpecimens(query: string): Promise<SpecimenSummary[]> {
  if (!query.trim()) return []

  const artists = await prisma.$queryRaw<Array<{ mbid: string; name: string; country: string | null; type: string | null }>>`
    SELECT a.mbid, a.name, a.country, a.type
    FROM "Artist" a
    JOIN "SpecimenClassification" sc ON sc."entityMbid" = a.mbid AND sc."entityType" = 'artist'
    WHERE a.name ILIKE ${'%' + query.trim() + '%'}
    GROUP BY a.mbid, a.name, a.country, a.type
    ORDER BY a.popularity DESC NULLS LAST
    LIMIT 12
  `.catch(() => [])

  // Get family for each artist
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
    primaryFamily: familyMap.get(a.mbid)?.name ?? null,
    primaryFamilySlug: familyMap.get(a.mbid)?.slug ?? null,
    lineage: familyMap.get(a.mbid) ? [familyMap.get(a.mbid)!.name] : [],
  }))
}

/** Featured specimens for homepage — one per Sound Family, sorted by popularity */
export async function getFeaturedSpecimens(): Promise<SpecimenSummary[]> {
  const families = await prisma.genreTaxonomy.findMany({
    where: { level: 'family' },
    orderBy: { specimenCount: 'desc' },
  }).catch(() => [])

  const specimens: SpecimenSummary[] = []
  for (const fam of families) {
    const top = await prisma.$queryRaw<Array<{ mbid: string; name: string; country: string | null; type: string | null }>>`
      SELECT a.mbid, a.name, a.country, a.type
      FROM "SpecimenClassification" sc
      JOIN "Artist" a ON a.mbid = sc."entityMbid"
      WHERE sc."taxonomyId" = ${fam.id}
        AND sc."entityType" = 'artist'
      ORDER BY a.popularity DESC NULLS LAST
      LIMIT 1
    `.catch(() => [])
    if (top[0]) {
      specimens.push({
        mbid: top[0].mbid,
        name: top[0].name,
        country: top[0].country,
        type: top[0].type,
        primaryFamily: fam.name,
        primaryFamilySlug: fam.slug,
        lineage: [fam.name],
      })
    }
  }
  return specimens
}
```

**Step 3: Verify TypeScript compiles**

```bash
cd /Users/vmannem/soundgraph
pnpm --filter @soundgraph/genus build
```

Expected: No TypeScript errors.

**Step 4: Commit**

```bash
git add apps/genus/src/lib/
git commit -m "feat(genus): add data-service with taxonomy and specimen queries"
```

---

## Task 5: Homepage — Sound Family grid + search

**Files:**
- Modify: `apps/genus/src/app/page.tsx` (replace placeholder)

**Step 1: Rewrite `apps/genus/src/app/page.tsx`**

```tsx
import Link from 'next/link'
import { getSoundFamilies, getFeaturedSpecimens } from '@/lib/data-service'

export const dynamic = 'force-dynamic'

// Deterministic color per family slug
const FAMILY_COLORS: Record<string, { hue: number }> = {
  'hip-hop':     { hue: 35 },
  'rock':        { hue: 0  },
  'jazz':        { hue: 200 },
  'electronic':  { hue: 270 },
  'rnb-soul':    { hue: 320 },
  'folk-country':{ hue: 100 },
}

function familyColor(slug: string) {
  const h = FAMILY_COLORS[slug]?.hue ?? 60
  return {
    border:  `oklch(65% 0.18 ${h})`,
    bg:      `oklch(65% 0.06 ${h} / 0.12)`,
    text:    `oklch(75% 0.18 ${h})`,
  }
}

export default async function HomePage() {
  const [families, featured] = await Promise.all([
    getSoundFamilies(),
    getFeaturedSpecimens(),
  ])

  return (
    <main className="max-w-5xl mx-auto px-6 py-16 space-y-16">
      {/* Hero */}
      <section className="text-center space-y-4">
        <h1 className="text-6xl font-black tracking-tight" style={{ color: 'var(--genus-gold)' }}>
          GENUS
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Every sound has a lineage. Classify the specimen. Trace the strain.
        </p>
        <form action="/search" method="get" className="mt-6">
          <div className="flex gap-2 max-w-md mx-auto">
            <input
              name="q"
              type="text"
              placeholder="Search specimens…"
              className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--genus-gold)]"
            />
            <button
              type="submit"
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-black"
              style={{ background: 'var(--genus-gold)' }}
            >
              Search
            </button>
          </div>
        </form>
      </section>

      {/* Sound Families */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
          Sound Families
        </h2>
        {families.length === 0 ? (
          <p className="text-muted-foreground text-sm">No Sound Families seeded yet. Run <code className="font-mono bg-muted px-1 rounded">npx tsx scripts/seed-genus.ts</code>.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {families.map(fam => {
              const c = familyColor(fam.slug)
              return (
                <Link
                  key={fam.slug}
                  href={`/lineage/${fam.slug}`}
                  className="rounded-xl p-5 border transition-all hover:scale-[1.02] space-y-2"
                  style={{ borderColor: c.border, background: c.bg }}
                >
                  <div className="text-lg font-bold" style={{ color: c.text }}>
                    {fam.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fam.specimenCount} specimens
                  </div>
                  {fam.description && (
                    <div className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">
                      {fam.description}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Featured Specimens */}
      {featured.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Featured Specimens
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {featured.map(spec => {
              const c = familyColor(spec.primaryFamilySlug ?? '')
              return (
                <Link
                  key={spec.mbid}
                  href={`/specimen/${spec.mbid}`}
                  className="rounded-lg p-3 border flex flex-col gap-1.5 hover:bg-accent transition-colors"
                  style={{ borderColor: c.border }}
                >
                  <div className="text-xs font-semibold truncate" style={{ color: c.text }}>
                    {spec.primaryFamily}
                  </div>
                  <div className="text-sm font-medium truncate">{spec.name}</div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}
```

**Step 2: Verify build**

```bash
pnpm --filter @soundgraph/genus build
```

Expected: No errors.

**Step 3: Dev server smoke test**

```bash
pnpm --filter @soundgraph/genus dev
```

Open http://localhost:3001. Expected: GENUS homepage with Sound Families grid (6 tiles if seed ran, or "No Sound Families" message if not seeded yet).

**Step 4: Commit**

```bash
git add apps/genus/src/app/page.tsx
git commit -m "feat(genus): homepage with Sound Family grid and featured specimens"
```

---

## Task 6: Sound Profile radar chart component

**Files:**
- Create: `apps/genus/src/components/sound-profile-radar.tsx`

**Step 1: Create `apps/genus/src/components/sound-profile-radar.tsx`**

```tsx
// Pure SVG radar chart — no chart library needed.
// 6 axes evenly spaced, value 0-100.

interface Props {
  values: {
    genreBreadth: number
    sampleUse: number
    collaborationRadius: number
    eraSpread: number
    instrumentDiversity: number
    geographicReach: number
  }
}

const AXES = [
  { key: 'genreBreadth',        label: 'Genre Breadth' },
  { key: 'sampleUse',           label: 'Sample Use' },
  { key: 'collaborationRadius', label: 'Collab Radius' },
  { key: 'eraSpread',           label: 'Era Spread' },
  { key: 'instrumentDiversity', label: 'Instrument Diversity' },
  { key: 'geographicReach',     label: 'Geographic Reach' },
] as const

const SIZE = 280
const CX = SIZE / 2
const CY = SIZE / 2
const MAX_R = 90
const N = AXES.length

function polarToXY(angle: number, r: number) {
  // 0 = top (-90 deg offset so first axis points up)
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function buildPolygon(values: number[]): string {
  return values
    .map((v, i) => {
      const angle = (360 / N) * i
      const r = (v / 100) * MAX_R
      const { x, y } = polarToXY(angle, r)
      return `${x},${y}`
    })
    .join(' ')
}

export function SoundProfileRadar({ values }: Props) {
  const dataValues = AXES.map(a => values[a.key])
  const polygon = buildPolygon(dataValues)

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [25, 50, 75, 100]

  return (
    <div className="w-full max-w-xs mx-auto">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: '100%', height: 'auto' }}>
        {/* Grid rings */}
        {rings.map(pct => {
          const r = (pct / 100) * MAX_R
          const pts = Array.from({ length: N }, (_, i) => {
            const { x, y } = polarToXY((360 / N) * i, r)
            return `${x},${y}`
          }).join(' ')
          return (
            <polygon
              key={pct}
              points={pts}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
          )
        })}

        {/* Axis spokes */}
        {AXES.map((axis, i) => {
          const angle = (360 / N) * i
          const { x, y } = polarToXY(angle, MAX_R)
          return (
            <line
              key={axis.key}
              x1={CX} y1={CY}
              x2={x} y2={y}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          )
        })}

        {/* Data polygon */}
        <polygon
          points={polygon}
          fill="oklch(78% 0.18 85 / 0.25)"
          stroke="oklch(78% 0.18 85)"
          strokeWidth={2}
        />

        {/* Data dots */}
        {dataValues.map((v, i) => {
          const angle = (360 / N) * i
          const r = (v / 100) * MAX_R
          const { x, y } = polarToXY(angle, r)
          return (
            <circle
              key={i}
              cx={x} cy={y} r={3.5}
              fill="oklch(78% 0.18 85)"
            />
          )
        })}

        {/* Axis labels */}
        {AXES.map((axis, i) => {
          const angle = (360 / N) * i
          const labelR = MAX_R + 18
          const { x, y } = polarToXY(angle, labelR)
          const anchor = x < CX - 5 ? 'end' : x > CX + 5 ? 'start' : 'middle'
          return (
            <text
              key={axis.key}
              x={x} y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={9}
              fill="rgba(255,255,255,0.5)"
              style={{ userSelect: 'none' }}
            >
              {axis.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
```

**Step 2: Build check**

```bash
pnpm --filter @soundgraph/genus build
```

Expected: No TypeScript errors.

**Step 3: Commit**

```bash
git add apps/genus/src/components/
git commit -m "feat(genus): add SoundProfileRadar SVG component"
```

---

## Task 7: Specimen page (`/specimen/[mbid]`)

**Files:**
- Create: `apps/genus/src/app/specimen/[mbid]/page.tsx`

**Step 1: Create `apps/genus/src/app/specimen/[mbid]/page.tsx`**

```tsx
import Link from 'next/link'
import { getSpecimenDetail } from '@/lib/data-service'
import { SoundProfileRadar } from '@/components/sound-profile-radar'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ mbid: string }>
}

const LEVEL_LABELS: Record<string, string> = {
  family: 'Sound Family',
  movement: 'Movement',
  scene: 'Scene',
  sound: 'Sound',
  strain: 'Strain',
}

export default async function SpecimenPage({ params }: Props) {
  const { mbid } = await params
  const specimen = await getSpecimenDetail(mbid)

  if (!specimen) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to GENUS
        </Link>
        <p className="mt-8 text-muted-foreground">
          Specimen not found in GENUS classification system.
          <br />
          <span className="text-xs">MBID: {mbid}</span>
          {' '}
          <Link href={`/search?q=${mbid}`} className="underline text-xs">Search by MBID</Link>
        </p>
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-foreground">GENUS</Link>
        {specimen.lineage.map((segment, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span>›</span>
            <span className="text-foreground/70">{segment}</span>
          </span>
        ))}
        <span>›</span>
        <span className="font-semibold text-foreground">{specimen.name}</span>
      </nav>

      {/* 3-column layout on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Left: Classification panel */}
        <aside className="space-y-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Specimen
            </div>
            <h1 className="text-3xl font-black" style={{ color: 'var(--genus-gold)' }}>
              {specimen.name}
            </h1>
            {specimen.type && (
              <div className="text-sm text-muted-foreground mt-1">{specimen.type}</div>
            )}
            {specimen.country && (
              <div className="text-xs text-muted-foreground">{specimen.country}</div>
            )}
          </div>

          {/* Lineage / classifications */}
          {specimen.classifications.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Lineage
              </div>
              {specimen.classifications.map(c => (
                <Link
                  key={c.taxonomyId}
                  href={`/lineage/${c.slug}`}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 border border-border hover:bg-accent transition-colors"
                >
                  <div className="text-xs text-muted-foreground w-20 shrink-0">
                    {LEVEL_LABELS[c.level] ?? c.level}
                  </div>
                  <div className="text-sm font-medium">{c.name}</div>
                </Link>
              ))}
            </div>
          )}

          {/* Top tags */}
          {specimen.tags.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Sound Signature
              </div>
              <div className="flex flex-wrap gap-1.5">
                {specimen.tags.slice(0, 8).map(t => (
                  <span
                    key={t.tag}
                    className="px-2 py-0.5 rounded-full text-xs border border-border text-muted-foreground"
                  >
                    {t.tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Center: Sound Profile radar */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center">
            Sound Profile
          </div>
          {specimen.soundProfile ? (
            <SoundProfileRadar values={specimen.soundProfile} />
          ) : (
            <div className="w-full aspect-square rounded-xl border border-border flex items-center justify-center">
              <p className="text-xs text-muted-foreground text-center px-4">
                Sound Profile not yet computed.
                <br />Run <code className="font-mono">seed-genus.ts</code> to generate.
              </p>
            </div>
          )}
        </div>

        {/* Right: Origins & Related */}
        <aside className="space-y-6">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Origins
            </div>
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
              {specimen.country && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Geography</span>
                  <span>{specimen.country}</span>
                </div>
              )}
              {specimen.primaryFamily && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sound Family</span>
                  <Link
                    href={`/lineage/${specimen.primaryFamilySlug}`}
                    className="hover:text-primary transition-colors"
                    style={{ color: 'var(--genus-gold)' }}
                  >
                    {specimen.primaryFamily}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {specimen.relatedSpecimens.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Related Specimens
              </div>
              <div className="space-y-1">
                {specimen.relatedSpecimens.map(rel => (
                  <Link
                    key={rel.mbid}
                    href={`/specimen/${rel.mbid}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-accent transition-colors group"
                  >
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">
                      {rel.name}
                    </span>
                    {rel.primaryFamily && (
                      <span className="text-xs text-muted-foreground">{rel.primaryFamily}</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Link to SoundGraph */}
          <div className="pt-2 border-t border-border">
            <Link
              href={`http://localhost:3000/artist/${mbid}`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              target="_blank"
            >
              View on SoundGraph →
            </Link>
          </div>
        </aside>
      </div>
    </main>
  )
}
```

**Step 2: Build check**

```bash
pnpm --filter @soundgraph/genus build
```

Expected: No errors.

**Step 3: Dev smoke test**

Start dev server and navigate to a specimen page using a known artist MBID from the DB:

```bash
# Get a classified artist MBID
/opt/homebrew/opt/postgresql@16/bin/psql -U vmannem -d soundgraph_import -c \
  "SELECT a.mbid, a.name FROM \"SpecimenClassification\" sc JOIN \"Artist\" a ON a.mbid = sc.\"entityMbid\" LIMIT 5;"
```

Open `http://localhost:3001/specimen/<mbid>`. Expected: Three-column layout with name, lineage, radar chart (or graceful "not computed" message), related specimens.

**Step 4: Commit**

```bash
git add apps/genus/src/app/specimen/
git commit -m "feat(genus): specimen page with classification, radar chart, related specimens"
```

---

## Task 8: Search page + taxonomy browser

**Files:**
- Create: `apps/genus/src/app/search/page.tsx`
- Create: `apps/genus/src/app/lineage/[slug]/page.tsx`

**Step 1: Create `apps/genus/src/app/search/page.tsx`**

```tsx
import Link from 'next/link'
import { searchSpecimens } from '@/lib/data-service'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''
  const results = query ? await searchSpecimens(query) : []

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to GENUS
        </Link>
        <h1 className="text-2xl font-bold mt-4">Search Specimens</h1>
      </div>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          type="text"
          defaultValue={query}
          autoFocus
          placeholder="Search by artist name…"
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--genus-gold)]"
        />
        <button
          type="submit"
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-black"
          style={{ background: 'var(--genus-gold)' }}
        >
          Search
        </button>
      </form>

      {query && (
        <div>
          <div className="text-xs text-muted-foreground mb-4">
            {results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
          </div>
          {results.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No classified specimens found. Try a different name.
            </p>
          ) : (
            <div className="space-y-1">
              {results.map(spec => (
                <Link
                  key={spec.mbid}
                  href={`/specimen/${spec.mbid}`}
                  className="flex items-center justify-between rounded-lg px-4 py-3 border border-border hover:bg-accent transition-colors group"
                >
                  <div>
                    <div className="font-medium group-hover:text-primary transition-colors">
                      {spec.name}
                    </div>
                    {spec.lineage.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {spec.lineage.join(' › ')}
                      </div>
                    )}
                  </div>
                  {spec.primaryFamily && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full border"
                      style={{ borderColor: 'var(--genus-gold-muted)', color: 'var(--genus-gold)' }}
                    >
                      {spec.primaryFamily}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
```

**Step 2: Create `apps/genus/src/app/lineage/[slug]/page.tsx`**

```tsx
import Link from 'next/link'
import { getTaxonomyNode, getSoundFamilies } from '@/lib/data-service'
import { prisma } from '@soundgraph/database'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function LineagePage({ params }: Props) {
  const { slug } = await params
  const node = await getTaxonomyNode(slug)

  if (!node) {
    const families = await getSoundFamilies()
    return (
      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to GENUS
        </Link>
        <p className="mt-8 text-muted-foreground">Sound Family &ldquo;{slug}&rdquo; not found.</p>
        <div className="mt-4 flex gap-2 flex-wrap">
          {families.map(f => (
            <Link key={f.slug} href={`/lineage/${f.slug}`}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-accent">
              {f.name}
            </Link>
          ))}
        </div>
      </main>
    )
  }

  // Get top specimens in this taxonomy node
  const specimens = await prisma.$queryRaw<Array<{ mbid: string; name: string; country: string | null }>>`
    SELECT a.mbid, a.name, a.country
    FROM "SpecimenClassification" sc
    JOIN "Artist" a ON a.mbid = sc."entityMbid"
    WHERE sc."taxonomyId" = ${node.id}
      AND sc."entityType" = 'artist'
    ORDER BY a.popularity DESC NULLS LAST
    LIMIT 20
  `.catch(() => [])

  // Build breadcrumb from parent chain
  const breadcrumb: Array<{ name: string; slug: string }> = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = node
  while (current.parent) {
    breadcrumb.unshift({ name: current.parent.name, slug: current.parent.slug })
    current = current.parent
  }

  const LEVEL_LABELS: Record<string, string> = {
    family: 'Sound Family', movement: 'Movement', scene: 'Scene', sound: 'Sound', strain: 'Strain',
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
        <Link href="/" className="hover:text-foreground">GENUS</Link>
        {breadcrumb.map(b => (
          <span key={b.slug} className="flex items-center gap-1.5">
            <span>›</span>
            <Link href={`/lineage/${b.slug}`} className="hover:text-foreground">{b.name}</Link>
          </span>
        ))}
        <span>›</span>
        <span className="font-semibold text-foreground">{node.name}</span>
      </nav>

      {/* Header */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {LEVEL_LABELS[node.level] ?? node.level}
        </div>
        <h1 className="text-4xl font-black" style={{ color: 'var(--genus-gold)' }}>
          {node.name}
        </h1>
        {node.description && (
          <p className="text-muted-foreground mt-2 max-w-xl">{node.description}</p>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          {node.specimenCount} specimens
        </p>
      </div>

      {/* Sub-levels */}
      {node.children.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {LEVEL_LABELS[node.children[0].level] ?? 'Sub-categories'}s
          </h2>
          <div className="flex flex-wrap gap-2">
            {node.children.map(child => (
              <Link
                key={child.slug}
                href={`/lineage/${child.slug}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                {child.name}
                <span className="ml-1.5 text-xs text-muted-foreground">{child.specimenCount}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Specimens */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Specimens
        </h2>
        {specimens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No specimens classified here yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {specimens.map(spec => (
              <Link
                key={spec.mbid}
                href={`/specimen/${spec.mbid}`}
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent transition-colors group"
              >
                <div className="font-medium truncate group-hover:text-primary transition-colors">
                  {spec.name}
                </div>
                {spec.country && (
                  <div className="text-xs text-muted-foreground">{spec.country}</div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
```

**Step 3: Build check**

```bash
pnpm --filter @soundgraph/genus build
```

Expected: No errors.

**Step 4: Full smoke test**

```bash
pnpm --filter @soundgraph/genus dev
```

Test these routes:
- `http://localhost:3001/` — homepage with 6 Sound Family tiles
- `http://localhost:3001/lineage/hip-hop` — Hip-Hop lineage with specimen grid
- `http://localhost:3001/search?q=drake` — search results for Drake
- `http://localhost:3001/specimen/<drake-mbid>` — Drake specimen page with radar

**Step 5: Commit**

```bash
git add apps/genus/src/app/search/ apps/genus/src/app/lineage/
git commit -m "feat(genus): search page and taxonomy browser (/lineage/[slug])"
```

---

## Task 9: Final build verification + push

**Step 1: Full monorepo build**

```bash
cd /Users/vmannem/soundgraph
pnpm build
```

Expected: Both `@soundgraph/web` and `@soundgraph/genus` build with no errors.

**Step 2: Lint check**

```bash
pnpm lint
```

Expected: No errors (warnings acceptable).

**Step 3: Push to origin**

```bash
git push origin main
```

**Step 4: Use superpowers:finishing-a-development-branch skill**

Follow the skill to present options (merge, PR, keep, discard).
