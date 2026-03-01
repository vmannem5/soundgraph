# SoundGraph Advanced Features Design

**Date:** 2026-03-01
**Status:** Approved

---

## Goal

Add four parallel workstreams to SoundGraph:
1. Genre heatmap — artist sound evolution over time
2. Genre bubbles — genre/tag category in ConnectionBubbles
3. Sample chain ancestry — recursive sample tree on recording pages
4. Go-live infrastructure — DB deploy, nginx/HTTPS, security headers, domain

---

## Track 1: Genre Heatmap (Artist Page)

**Component:** `GenreHeatmap` — server component, no extra dependencies.

**Data:** New `getArtistGenreTimeline(mbid)` query in `data-service.ts`:
```sql
SELECT
  EXTRACT(YEAR FROM rg."firstReleaseDate"::date)::int AS year,
  rgt.tag,
  SUM(rgt.count)::int AS total_count
FROM "Artist" a
JOIN "Credit" c ON c."artistId" = a.id
JOIN "ReleaseRecording" rr ON rr."recordingId" = c."recordingId"
JOIN "Release" rel ON rel.id = rr."releaseId"
JOIN "ReleaseGroup" rg ON rg.id = rel."releaseGroupId"
JOIN "ReleaseGroupTag" rgt ON rgt."releaseGroupId" = rg.id
WHERE a.mbid = $mbid
  AND rg."firstReleaseDate" IS NOT NULL
  AND rg."firstReleaseDate" != ''
GROUP BY year, rgt.tag
ORDER BY year, total_count DESC
```

**Fallback:** When query returns empty (Hetzner before DB deploy, or no ReleaseRecording rows), render nothing — section is hidden.

**Rendering:** CSS grid — columns = 2-3 year era buckets, rows = top 8 genres by total count across all years. Cell background opacity = `count / maxCount`. Cells show count on hover (tooltip via `title` attribute). Genre row labels on left, year labels on top.

**Color:** Single hue per cell (`oklch(65% 0.18 <hue>)`) where hue is deterministic from genre name hash. Row label color matches cell hue.

**Interaction:** Click a cell → no navigation for now (future: filter discography).

**Placement:** Below discography grid, above Connections section on `/artist/[mbid]`.

**Header:** "Sound Evolution"

---

## Track 2: Genre Bubbles in ConnectionBubbles

**Change:** Add `GENRES` to `CAT` in `connection-bubbles.tsx`:
```typescript
GENRES: { label: 'Genres', color: '#f0d060', bg: 'rgba(240,208,96,0.18)' }
```

Add `getCatKey` branch: `if (t === 'genre') return 'GENRES'`

**Data wiring:**
- Artist page: pass `artist.tags` as connections with `type: 'genre'`, `targetType: 'tag'`, `targetId: tag.name`, `targetName: tag.name`, `importance: tag.count`
- Recording page: pass `recordingTags` the same way (needs tags added to `getRecordingConnections` return)

**Leaf click:** `router.push('/search?q=' + encodeURIComponent(ld.targetName))` when `targetType === 'tag'`

**Threshold:** Only include this category when ≥ 2 genre tags available.

---

## Track 3: Sample Chain Ancestry (Recording Page)

**Component:** `SampleChain` — server component, renders an indented tree.

**Data:** New `getArtistSampleChain(recordingMbid)` function that does 3 sequential lookups:
- Level 0: the recording itself
- Level 1: its `sampledTrack` entries
- Level 2: each level-1 track's `sampledTrack` entries

Uses existing Prisma `SampleRelation` includes, no raw SQL needed.

**Rendering:** Nested `<ul>` with left border lines and connecting dots. Each node = recording title + primary artist name + year (if available). Each node links to `/recording/[mbid]`.

```
"Song A" (2003)
  └─ samples "Song B" (1972) — Chaka Khan
              └─ samples "Song C" (1968) — James Brown
```

**Placement:** Below existing Samples list on `/recording/[mbid]`.

**Header:** "Sample Ancestry" — only shown when ≥ 1 sample relation exists.

---

## Track 4: Go-Live Infrastructure

### 4a. DB Deploy to Hetzner
1. `pg_dump -Fc soundgraph_import > /tmp/soundgraph_$(date +%Y%m%d).dump` locally
2. `rsync` dump to Hetzner `/tmp/`
3. `pg_restore -d soundgraph -U postgres --no-owner --role=soundgraph <dump>`
4. `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO soundgraph;`
5. Verify: check `ReleaseRecording` row count > 0

### 4b. nginx + HTTPS
```nginx
server {
    listen 80;
    server_name <domain>;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name <domain>;
    ssl_certificate /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    limit_req zone=one burst=20 nodelay;
}
```
Certbot: `certbot --nginx -d <domain>`

### 4c. Security Headers (next.config.ts)
```typescript
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ]
}]
```

### 4d. Domain
Buy `.com` from Cloudflare Registrar (~$10/yr). Set A record → `178.156.244.124`. Enable Cloudflare proxy for DDoS protection + free CDN.

---

## Architecture Notes

- All new components are server components (no added client JS bundle weight) except GenreHeatmap tooltip which uses `title` attribute
- No new npm packages needed for any feature
- All SQL queries use parameterized inputs (no injection risk)
- Genre heatmap gracefully hides when no data — safe to deploy before DB migration

---

## Success Criteria

- Genre heatmap renders for artists with release history (Drake, Miles Davis)
- Genre bubbles appear as a 5th category in ConnectionBubbles when tags are present
- Sample ancestry shows 2-3 level chains on recording pages with known samples
- Production site reachable at HTTPS domain with A+ security headers
- `ReleaseRecording` > 0 rows on Hetzner after DB deploy
