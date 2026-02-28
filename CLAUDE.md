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

# Install dependencies
pnpm install          # Install all workspace packages
pnpm --filter @soundgraph/web add <pkg>         # Add dep to web app
pnpm --filter @soundgraph/database add <pkg>    # Add dep to database package
```

## Architecture

**Monorepo layout:**
```
apps/web/          — Next.js 15 App Router app (@soundgraph/web)
packages/database/ — Prisma client + schema (@soundgraph/database)
scripts/           — Hetzner setup, MusicBrainz import, seed scripts
```

**Data flow:**
```
MusicBrainz API (1 req/sec, no key) ──┐
                                       ├─→ data-service.ts ──→ Next.js pages/routes
Spotify Web API (Client Credentials) ──┘         │
                                                  ↓
                                     PostgreSQL (Hetzner, 1-week cache TTL)
```

The data service queries Prisma DB first for cached/seeded data, then fetches from MusicBrainz/Spotify APIs, merges and deduplicates results.

**Key files:**
- `apps/web/src/lib/data-service.ts` — main data layer (search, artist/recording fetch, connection graph)
- `apps/web/src/lib/musicbrainz.ts` — MusicBrainz REST client with 1 req/sec rate limiter
- `apps/web/src/lib/spotify.ts` — Spotify Client Credentials client (search, track/artist/album, ISRC)
- `packages/database/prisma/schema.prisma` — full graph schema
- `packages/database/src/index.ts` — singleton PrismaClient export

**Prisma schema groups:**
- Core entities: `Artist`, `Recording`, `ReleaseGroup`, `Release`, `ReleaseRecording`
- Graph edges: `Credit` (artist→recording roles), `SampleRelation` (recording samples recording)
- Taxonomy: `ArtistTag`, `RecordingTag`, `ReleaseGroupTag`, `ArtistAlias`
- Cache: `ApiCache` (key, data JSON, source, expiresAt)

**Frontend stack:**
- Next.js 15 App Router with server components by default
- Tailwind CSS v4 — uses `@import "tailwindcss"` syntax (not `@tailwind` directives)
- shadcn/ui — New York style, Neutral palette, components in `apps/web/src/components/ui/`
- `@xyflow/react` (React Flow v12) for the interactive knowledge graph/mind map
- Dark/light theme via `ThemeProvider` (persists to localStorage)
- Path alias `@/*` → `apps/web/src/*`

**Environment variables** (never commit these):
- `packages/database/.env` — `DATABASE_URL`, `DIRECT_URL`
- `apps/web/.env.local` — `DATABASE_URL`, `DIRECT_URL`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`

**Prisma version:** 5.22.0 (pinned — Prisma 7 has breaking changes incompatible with this schema)

## Deployment

**Hosting:** Hetzner VPS (178.156.244.124), Ubuntu 24.04
**Production URL:** http://178.156.244.124:3000
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

**Server paths:**
- App: `/opt/soundgraph`
- Env files: `/opt/soundgraph/apps/web/.env.local`, `/opt/soundgraph/packages/database/.env`
- PM2 logs: `pm2 logs soundgraph`

**Infrastructure scripts:**
- `scripts/setup-hetzner.sh` — Initial server setup (PostgreSQL, firewall, user)
- `scripts/import-musicbrainz.sh` — Full MB data dump import pipeline
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

**Node.js v25 TLS incompatibility with MusicBrainz:** Local dev (Node.js v25) uses `curl` via `execFileSync` as a workaround. Production (Node.js 20 on Hetzner) uses native `fetch` directly — no workaround needed.

**Prisma CLI version:** Always use `npx prisma` (local v5.22.0), never `pnpm dlx prisma` (pulls latest v7 which has breaking changes).
