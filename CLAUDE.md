# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the monorepo root (`~/soundgraph`) unless noted.

```bash
# Development
pnpm dev              # Start Next.js dev server with Turbopack (http://localhost:3000)
pnpm build            # Production build
pnpm lint             # ESLint

# Database
pnpm --filter @soundgraph/database db:push      # Push schema changes (no migration history)
pnpm --filter @soundgraph/database db:generate  # Regenerate Prisma client after schema changes
pnpm --filter @soundgraph/database db:migrate   # Create a migration (use for prod-ready changes)
pnpm --filter @soundgraph/database db:studio    # Open Prisma Studio GUI

# Local PostgreSQL (psql not on PATH — use full path)
/opt/homebrew/opt/postgresql@16/bin/psql -U vmannem -d soundgraph_import

# Install dependencies
pnpm install          # Install all workspace packages
pnpm --filter @soundgraph/web add <pkg>         # Add dep to web app
pnpm --filter @soundgraph/database add <pkg>    # Add dep to database package
```

No test framework is configured yet.

## Architecture

**Monorepo layout (pnpm workspaces):**
```
apps/web/          — Next.js 15 App Router app (@soundgraph/web)
packages/database/ — Prisma client + schema (@soundgraph/database)
scripts/           — Hetzner setup, MusicBrainz import, seed scripts
```

**Data flow — DB-first with API fallback:**
```
Local PostgreSQL (soundgraph_import) ──→ data-service.ts ──→ Next.js pages/routes
         ↑ primary                             ↓ fallback (may fail on Node 25)
MusicBrainz API (1 req/sec) ──────────────────→┘
Spotify Web API (Client Credentials) ──────────→┘ (enrichment: images, ISRC)
```

All detail pages (`getArtistDetails`, `getRecordingDetails`, `getRecordingConnections`) try the local DB first and fall back to MB API. If the API also fails, DB data is served without API enrichment. This is critical because Node.js v25 has TLS issues with MusicBrainz.

**Local database:** `soundgraph_import` on PostgreSQL@16 (Homebrew). Contains a curated MusicBrainz subset focused on songs with samples and well-known artists (~3.4M recordings from ~38M total). Both `mb_staging` (raw dump) and `public` (transformed SoundGraph schema) exist.

| Table | Rows |
|-------|------|
| Recording | 3,440,284 |
| Artist | 2,814,051 |
| Credit | 5,258,697 |
| ReleaseGroup | 4,162,508 |
| Release | 5,331,825 |
| RecordingTag | 2,342,679 |
| SampleRelation | 22,469 |

**Search architecture** (`data-service.ts`): `searchAll()` uses a three-tier ranking strategy:
1. **PostgreSQL full-text** (`to_tsquery` via `search_vector` GIN index) with trigram fallback (`%` via `pg_trgm` GIN index)
2. **Pre-computed `popularity`** column (credit count + tag count from DB)
3. **Spotify re-ranking** — always calls Spotify search in parallel, matches DB results by title+artist name to get Spotify popularity (0-100), and re-sorts results. This ensures famous songs (Drake's "Headlines") rank above obscure DB matches with more credits. Title-only fallback gets 30% weight to avoid wrong matches.

**Key files:**
- `apps/web/src/lib/data-service.ts` — main data layer (search, artist/recording fetch, taxonomy, sound profiles)
- `apps/web/src/lib/musicbrainz.ts` — MusicBrainz REST client with 1 req/sec rate limiter
- `apps/web/src/lib/spotify.ts` — Spotify Client Credentials client (search, track/artist/album, ISRC)
- `apps/web/src/lib/rate-limiter.ts` — `RateLimiter` class, singleton `mbRateLimiter` at 1 req/sec
- `apps/web/src/components/connection-bubbles.tsx` — d3-pack bubble chart for artist connections
- `apps/web/src/components/sound-profile-radar.tsx` — SVG radar chart (6 axes)
- `apps/web/src/components/release-timeline.tsx` — SVG release timeline visualization
- `apps/web/src/components/theme-toggle.tsx` — Dark/light theme toggle button
- `apps/web/src/components/release-group-cover.tsx` — cover art with JS onError fallback (must be client component)
- `packages/database/prisma/schema.prisma` — full graph schema
- `packages/database/src/index.ts` — singleton PrismaClient export

**Routes:**

| Path | Type | Description |
|------|------|-------------|
| `/` | Page | Homepage with sound families and artist search |
| `/search` | Page | Artist search |
| `/artist/[mbid]` | Page | Artist detail with sound profile radar, lineage, connections |
| `/lineage/[slug]` | Page | Sound family/movement taxonomy page |
| `/recording/[mbid]` | Page | Recording detail + Spotify embed |
| `/release-group/[id]` | Page | Album/EP/Single detail + releases list |
| `/api/search?q=` | API | Merged DB + Spotify search |
| `/api/artist/[mbid]` | API | Artist details |
| `/api/recording/[mbid]` | API | Recording details |
| `/api/recording/[mbid]/connections` | API | Connection graph for knowledge graph |

**Key components:**
- `connection-bubbles.tsx` — d3-pack SVG bubble chart for artist connections
- `sound-profile-radar.tsx` — SVG radar chart (6 axes)
- `release-timeline.tsx` — SVG release timeline visualization
- `theme-toggle.tsx` — Dark/light theme toggle button

**Prisma schema groups:**
- Core entities: `Artist`, `Recording`, `ReleaseGroup`, `Release`, `ReleaseRecording`
- Graph edges: `Credit` (artist→recording roles), `SampleRelation` (recording samples recording)
- Taxonomy: `ArtistTag`, `RecordingTag`, `ReleaseGroupTag`, `ArtistAlias`
- Cache: `ApiCache` (key, data JSON, source, expiresAt)
- Computed: `popularity` column on Artist and Recording (credit count + tag count, used for search ranking)
- Search: `search_vector` (tsvector) column on Artist and Recording with GIN indexes; trigram GIN indexes on `name`/`title`

**Frontend stack:**
- Next.js 15 App Router with server components by default; `force-dynamic` on pages with API calls
- Tailwind CSS v4 — uses `@import "tailwindcss"` syntax (not `@tailwind` directives), OKLch color system in `globals.css`
- shadcn/ui — New York style, Neutral palette, components in `apps/web/src/components/ui/`
- `d3-hierarchy` — used by ConnectionBubbles for circle packing visualization
- Dark/light theme via custom ThemeToggle (persists to localStorage, `data-theme` attribute toggle)
- Path alias `@/*` → `apps/web/src/*`

**UI patterns:**
- **Search results** — artist tiles (72px circles, horizontal scroll) + song rows (44px album art, numbered, alternating bg). Spotify images matched by title+artist name; colorful gradient fallbacks for unmatched items (10 deterministic gradients hashed from name).
- **Artist tiles**: Use inline `style` props for critical dimensions (not Tailwind classes) to avoid sizing bugs — Spotify images can break Tailwind constraints.
- **Recording page**: header card + Spotify embed + tabbed view (Mind Map, Credits, Performers, Samples)

**Environment variables** (never commit these):
- `packages/database/.env` — `DATABASE_URL`, `DIRECT_URL` (currently pointed at local `soundgraph_import`)
- `apps/web/.env.local` — `DATABASE_URL`, `DIRECT_URL`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- Supabase credentials are commented out in `.env` — uncomment to switch back

**Prisma version:** 5.22.0 (pinned — Prisma 7 has breaking changes incompatible with this schema)

## ESLint

Config in `apps/web/eslint.config.mjs`. Extends `next/core-web-vitals` + `next/typescript`. Rules `@typescript-eslint/no-explicit-any` and `@next/next/no-img-element` are disabled for data-service, API clients, and components that use raw `<img>` tags.

## Deployment

**Hosting:** Hetzner VPS (178.156.244.124), Ubuntu 24.04
**Production URL:** https://musicgenus.com
**Server stack:** Node.js 20 LTS + PM2 + PostgreSQL 16

**Deploy process:**
```bash
ssh root@178.156.244.124
cd /opt/soundgraph
git pull origin main
pnpm install
pnpm build
pm2 restart soundgraph
```

**Pending:** The local `soundgraph_import` database needs to be `pg_dump`ed and restored on Hetzner to replace the Supabase-backed production DB.

**Server paths:**
- App: `/opt/soundgraph`
- Env files: `/opt/soundgraph/apps/web/.env.local`, `/opt/soundgraph/packages/database/.env`
- PM2 logs: `pm2 logs soundgraph`

**Infrastructure scripts:**
- `scripts/setup-hetzner.sh` — Initial server setup (PostgreSQL, firewall, user)
- `scripts/import-musicbrainz.sh` — Full MB data dump import pipeline (staging → transform → SoundGraph schema)
- `scripts/seed-artists.ts` — Seed specific artists from MB API

## MusicBrainz API notes

- Rate limit: 1 request/second (enforced client-side via `RateLimiter` in `rate-limiter.ts`)
- Must set `User-Agent` header: `SoundGraph/0.1.0 (email)`
- No API key required
- ISRC codes are the primary cross-reference key to link MB recordings → Spotify tracks

## Spotify API notes

Deprecated endpoints (do not use): `audio-features`, `audio-analysis`, `recommendations`, `related-artists`

Still available: `search`, `tracks`, `artists`, `albums`, `top-tracks`

## Known issues

**Node.js v25 TLS incompatibility with MusicBrainz:** Local dev (Node.js v25) uses `curl` via `execFileSync` as a workaround (`musicbrainz.ts` detects Node version at runtime). Production (Node.js 20 on Hetzner) uses native `fetch` directly. Detail pages now gracefully fall back to local DB when API calls fail.

**Prisma CLI version:** Always use `npx prisma` (local v5.22.0), never `pnpm dlx prisma` (pulls latest v7 which has breaking changes).

**Search ranking requires `popularity` column:** Both `Recording` and `Artist` tables have pre-computed `popularity` columns (currently populated for all 3.4M recordings and 2.8M artists). If these become stale or NULL, re-compute with:
```sql
UPDATE "Recording" r SET popularity = sub.score FROM (
  SELECT r2.id, COALESCE(cc.cnt,0)+COALESCE(tc.cnt,0) AS score
  FROM "Recording" r2
  LEFT JOIN (SELECT "recordingId", count(*)::int as cnt FROM "Credit" GROUP BY "recordingId") cc ON cc."recordingId"=r2.id
  LEFT JOIN (SELECT "recordingId", count(*)::int as cnt FROM "RecordingTag" GROUP BY "recordingId") tc ON tc."recordingId"=r2.id
) sub WHERE r.id=sub.id;
```
Same pattern for `"Artist"` with `"artistId"` and `"ArtistTag"`. These queries take ~5 minutes each on the full dataset.

**Spotify image matching limitations:** Search results match Spotify images by title+artist name. Songs by obscure artists or with common titles may not get album art. The fallback is a deterministic colorful gradient. Spotify search is always called in parallel to provide re-ranking and images.

## Current State (2026-03-02)

**Merged:** apps/genus (MusicGenus) has been merged into apps/web. The unified app now includes:
- Homepage with sound families and artist search
- Artist pages with sound profile radar, release timeline, lineage
- Search page for artists
- Lineage/taxonomy pages
- Recording and release-group pages (from original web)

**Removed:** React Flow knowledge graph (was never fully implemented)
**Kept:** ConnectionBubbles (d3-pack SVG bubble chart)

## Next Steps (priority order)

1. **Deploy merged app to Hetzner** — Push changes and restart services
2. **Add TheAudioDB integration** — Supplementary artist images
3. **Family-tree connections** — Future visualization improvement

## Gotchas / Watch Out For

- **`SampleRelation` columns**: `samplingTrackId` (the song that does the sampling) and `sampledTrackId` (the song being sampled). NOT `recordingId`/`sampledRecordingId`. Easy to get wrong, fails silently via `.catch(() => [])`.
- **Prisma CLI**: always `npx prisma` (local v5.22.0). Never `pnpm dlx prisma` (pulls v7 which breaks schema).
- **`ReleaseGroupCover` must be a client component** — uses `onError` browser API for cover art fallback.
- **Theme uses `data-theme` attribute** (not `.dark` class) — controlled by `theme-toggle.tsx`

## Pending work

- **Deploy DB to Hetzner**: `pg_dump` local `soundgraph_import` and restore on production server
- **Search ranking**: DB credit/tag counts favor classic rock over modern pop. Spotify re-ranking helps but not perfect.
