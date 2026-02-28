# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the monorepo root (`~/soundgraph`) unless noted.

```bash
# Development
pnpm dev              # Start Next.js dev server with Turbopack (http://localhost:3000)
pnpm build            # Production build
pnpm lint             # ESLint

# Database (run from packages/database)
pnpm --filter @soundgraph/database db:push      # Push schema changes to Supabase (no migration history)
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
```

**Data flow:**
```
MusicBrainz API (1 req/sec, no key) ──┐
                                       ├─→ data-service.ts ──→ Next.js pages/routes
Spotify Web API (Client Credentials) ──┘         │
                                                  ↓
                                        ApiCache (Supabase, 1-week TTL)
```

The app is **API-first**: it fetches from MusicBrainz/Spotify on demand and caches results in the `ApiCache` Prisma model. No bulk data import. Phase 2 (separate plan) will add a full MusicBrainz dump.

**Key files to understand the system:**
- `apps/web/src/lib/data-service.ts` — main data layer (search, artist/recording fetch, connection graph extraction)
- `apps/web/src/lib/musicbrainz.ts` — MusicBrainz REST client with 1 req/sec rate limiter
- `apps/web/src/lib/spotify.ts` — Spotify client (DEFERRED — not yet created)
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
- Path alias `@/*` → `apps/web/src/*`

**Environment variables** (never commit these):
- `packages/database/.env` — `DATABASE_URL` for Prisma CLI commands
- `apps/web/.env.local` — `DATABASE_URL`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`

**Prisma version:** 5.22.0 (pinned — Prisma 7 has breaking changes incompatible with this schema)

## MusicBrainz API notes

- Rate limit: 1 request/second (enforced client-side via `RateLimiter` in `rate-limiter.ts`)
- Must set `User-Agent` header: `SoundGraph/0.1.0 (email)`
- No API key required
- ISRC codes are the primary cross-reference key to link MB recordings → Spotify tracks

## Spotify API notes (as of 2024)

Deprecated endpoints (do not use): `audio-features`, `audio-analysis`, `recommendations`, `related-artists`

Still available: `search`, `tracks`, `artists`, `albums`, `top-tracks`

## Known issues

**Node.js v25 TLS incompatibility with MusicBrainz:** Node.js v25 (OpenSSL 3.6.0) TLS connections are rejected by MusicBrainz servers. `musicbrainz.ts` works around this by using `curl` via `execFileSync` locally and falling back to native `fetch` on Vercel/production (Node.js 20 LTS). If upgrading to Node.js 20 or 22 LTS, the curl workaround is unnecessary.

**Prisma CLI version:** Always use `npx prisma` (local v5.22.0), never `pnpm dlx prisma` (pulls latest v7 which has breaking changes).
