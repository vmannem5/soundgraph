#!/bin/bash
# SoundGraph - MusicBrainz Data Import Script
# Downloads the MB dump and imports selected tables into PostgreSQL
# Run on the Hetzner VPS after setup-hetzner.sh
# Usage: ssh root@YOUR_SERVER_IP 'bash -s' < scripts/import-musicbrainz.sh

set -euo pipefail

WORK_DIR="/tmp/mb-import"
MB_DUMP_BASE="https://data.metabrainz.org/pub/musicbrainz/data/fullexport"

echo "=== MusicBrainz Data Import ==="

# 1. Find latest dump
echo "→ Finding latest MusicBrainz dump..."
LATEST=$(curl -s "$MB_DUMP_BASE/LATEST")
echo "  Latest dump: $LATEST"

DUMP_URL="${MB_DUMP_BASE}/${LATEST}/mbdump.tar.xz"
DUMP_DERIVED_URL="${MB_DUMP_BASE}/${LATEST}/mbdump-derived.tar.xz"

# 2. Create work directory
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

# 3. Download the main dump (contains core tables)
echo "→ Downloading main dump (~4GB compressed)... this will take a while"
if [ ! -f "mbdump.tar.xz" ]; then
  wget -q --show-progress "$DUMP_URL" -O mbdump.tar.xz
fi

# 4. Download derived dump (contains tags)
echo "→ Downloading derived dump (~500MB compressed)..."
if [ ! -f "mbdump-derived.tar.xz" ]; then
  wget -q --show-progress "$DUMP_DERIVED_URL" -O mbdump-derived.tar.xz
fi

# 5. Extract only the tables we need
echo "→ Extracting selected tables from main dump..."
MAIN_TABLES=(
  "mbdump/artist"
  "mbdump/artist_alias"
  "mbdump/artist_credit"
  "mbdump/artist_credit_name"
  "mbdump/recording"
  "mbdump/release_group"
  "mbdump/release_group_primary_type"
  "mbdump/release"
  "mbdump/release_country"
  "mbdump/medium"
  "mbdump/track"
  "mbdump/l_recording_recording"
  "mbdump/l_artist_recording"
  "mbdump/link"
  "mbdump/link_type"
  "mbdump/link_attribute"
  "mbdump/link_attribute_type"
  "mbdump/isrc"
  "mbdump/area"
  "mbdump/iso_3166_1"
  "mbdump/artist_type"
  "mbdump/release_group_primary_type"
)

tar -xJf mbdump.tar.xz "${MAIN_TABLES[@]}" 2>/dev/null || true

echo "→ Extracting tag tables from derived dump..."
DERIVED_TABLES=(
  "mbdump/artist_tag"
  "mbdump/recording_tag"
  "mbdump/release_group_tag"
  "mbdump/tag"
)

tar -xJf mbdump-derived.tar.xz "${DERIVED_TABLES[@]}" 2>/dev/null || true

echo "→ Extracted files:"
ls -lh mbdump/ | head -30

# 6. Create staging schema in PostgreSQL
echo "→ Creating staging tables in PostgreSQL..."
sudo -u postgres psql soundgraph <<'STAGING_SQL'

-- Staging tables (raw MusicBrainz format)
DROP SCHEMA IF EXISTS mb_staging CASCADE;
CREATE SCHEMA mb_staging;

CREATE TABLE mb_staging.artist (
  id INTEGER PRIMARY KEY,
  gid UUID NOT NULL,
  name TEXT NOT NULL,
  sort_name TEXT,
  begin_date_year INTEGER,
  begin_date_month INTEGER,
  begin_date_day INTEGER,
  end_date_year INTEGER,
  type INTEGER,
  area INTEGER,
  comment TEXT,
  ended BOOLEAN DEFAULT FALSE
);

CREATE TABLE mb_staging.artist_alias (
  id INTEGER PRIMARY KEY,
  artist INTEGER NOT NULL,
  name TEXT NOT NULL,
  locale TEXT,
  type INTEGER
);

CREATE TABLE mb_staging.artist_type (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  parent INTEGER,
  child_order INTEGER DEFAULT 0,
  description TEXT,
  gid UUID NOT NULL
);

CREATE TABLE mb_staging.artist_credit (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  artist_count INTEGER DEFAULT 1
);

CREATE TABLE mb_staging.artist_credit_name (
  artist_credit INTEGER NOT NULL,
  position INTEGER NOT NULL,
  artist INTEGER NOT NULL,
  name TEXT NOT NULL,
  join_phrase TEXT DEFAULT '',
  PRIMARY KEY (artist_credit, position)
);

CREATE TABLE mb_staging.recording (
  id INTEGER PRIMARY KEY,
  gid UUID NOT NULL,
  name TEXT NOT NULL,
  artist_credit INTEGER NOT NULL,
  length INTEGER,
  comment TEXT
);

CREATE TABLE mb_staging.release_group (
  id INTEGER PRIMARY KEY,
  gid UUID NOT NULL,
  name TEXT NOT NULL,
  artist_credit INTEGER NOT NULL,
  type INTEGER,
  comment TEXT
);

CREATE TABLE mb_staging.release (
  id INTEGER PRIMARY KEY,
  gid UUID NOT NULL,
  name TEXT NOT NULL,
  artist_credit INTEGER NOT NULL,
  release_group INTEGER NOT NULL,
  status INTEGER,
  barcode TEXT,
  comment TEXT
);

CREATE TABLE mb_staging.release_country (
  release INTEGER NOT NULL,
  country INTEGER NOT NULL,
  date_year INTEGER,
  date_month INTEGER,
  date_day INTEGER,
  PRIMARY KEY (release, country)
);

CREATE TABLE mb_staging.medium (
  id INTEGER PRIMARY KEY,
  release INTEGER NOT NULL,
  position INTEGER NOT NULL,
  format INTEGER,
  name TEXT DEFAULT ''
);

CREATE TABLE mb_staging.track (
  id INTEGER PRIMARY KEY,
  gid UUID NOT NULL,
  recording INTEGER NOT NULL,
  medium INTEGER NOT NULL,
  position INTEGER NOT NULL,
  number TEXT NOT NULL,
  name TEXT NOT NULL,
  artist_credit INTEGER NOT NULL,
  length INTEGER
);

CREATE TABLE mb_staging.link_type (
  id INTEGER PRIMARY KEY,
  parent INTEGER,
  child_order INTEGER DEFAULT 0,
  gid UUID NOT NULL,
  entity_type0 TEXT NOT NULL,
  entity_type1 TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  link_phrase TEXT NOT NULL,
  reverse_link_phrase TEXT NOT NULL,
  long_link_phrase TEXT NOT NULL
);

CREATE TABLE mb_staging.link (
  id INTEGER PRIMARY KEY,
  link_type INTEGER NOT NULL,
  begin_date_year INTEGER,
  begin_date_month INTEGER,
  begin_date_day INTEGER,
  end_date_year INTEGER,
  end_date_month INTEGER,
  end_date_day INTEGER,
  ended BOOLEAN DEFAULT FALSE
);

CREATE TABLE mb_staging.link_attribute (
  link INTEGER NOT NULL,
  attribute_type INTEGER NOT NULL,
  PRIMARY KEY (link, attribute_type)
);

CREATE TABLE mb_staging.link_attribute_type (
  id INTEGER PRIMARY KEY,
  parent INTEGER,
  root INTEGER NOT NULL,
  child_order INTEGER DEFAULT 0,
  gid UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE mb_staging.l_recording_recording (
  id INTEGER PRIMARY KEY,
  link INTEGER NOT NULL,
  entity0 INTEGER NOT NULL,
  entity1 INTEGER NOT NULL
);

CREATE TABLE mb_staging.l_artist_recording (
  id INTEGER PRIMARY KEY,
  link INTEGER NOT NULL,
  entity0 INTEGER NOT NULL,
  entity1 INTEGER NOT NULL
);

CREATE TABLE mb_staging.isrc (
  id INTEGER PRIMARY KEY,
  recording INTEGER NOT NULL,
  isrc TEXT NOT NULL
);

CREATE TABLE mb_staging.area (
  id INTEGER PRIMARY KEY,
  gid UUID NOT NULL,
  name TEXT NOT NULL,
  type INTEGER
);

CREATE TABLE mb_staging.iso_3166_1 (
  area INTEGER NOT NULL,
  code TEXT NOT NULL,
  PRIMARY KEY (area)
);

CREATE TABLE mb_staging.tag (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE mb_staging.artist_tag (
  artist INTEGER NOT NULL,
  tag INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (artist, tag)
);

CREATE TABLE mb_staging.recording_tag (
  recording INTEGER NOT NULL,
  tag INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (recording, tag)
);

CREATE TABLE mb_staging.release_group_tag (
  release_group INTEGER NOT NULL,
  tag INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (release_group, tag)
);

STAGING_SQL

echo "→ Staging tables created."

# 7. COPY data into staging tables
echo "→ Importing data into staging tables (this takes 10-30 minutes)..."

import_table() {
  local table=$1
  local file="mbdump/$table"
  if [ -f "$file" ]; then
    echo "  Importing $table..."
    sudo -u postgres psql soundgraph -c "\COPY mb_staging.$table FROM '$WORK_DIR/$file' WITH (FORMAT text, DELIMITER E'\t', NULL '\N')" 2>/dev/null || echo "  ⚠ Skipped $table (format mismatch, will handle manually)"
  else
    echo "  ⚠ Skipping $table (file not found)"
  fi
}

import_table "artist"
import_table "artist_alias"
import_table "artist_type"
import_table "artist_credit"
import_table "artist_credit_name"
import_table "recording"
import_table "release_group"
import_table "release"
import_table "release_country"
import_table "medium"
import_table "track"
import_table "link_type"
import_table "link"
import_table "link_attribute"
import_table "link_attribute_type"
import_table "l_recording_recording"
import_table "l_artist_recording"
import_table "isrc"
import_table "area"
import_table "iso_3166_1"
import_table "tag"
import_table "artist_tag"
import_table "recording_tag"
import_table "release_group_tag"

echo "→ Staging import complete. Row counts:"
sudo -u postgres psql soundgraph -c "
SELECT 'artist' as tbl, count(*) FROM mb_staging.artist
UNION ALL SELECT 'recording', count(*) FROM mb_staging.recording
UNION ALL SELECT 'release_group', count(*) FROM mb_staging.release_group
UNION ALL SELECT 'l_recording_recording (samples)', count(*) FROM mb_staging.l_recording_recording
UNION ALL SELECT 'l_artist_recording (credits)', count(*) FROM mb_staging.l_artist_recording
UNION ALL SELECT 'tag', count(*) FROM mb_staging.tag
ORDER BY 1;
"

# 8. Transform staging → SoundGraph schema
echo "→ Transforming staging data into SoundGraph schema..."

sudo -u postgres psql soundgraph <<'TRANSFORM_SQL'

-- Get the link type IDs for 'samples from' relationships
-- In MB, l_recording_recording with link_type 'samples material' (id varies)

-- Transform Artists
INSERT INTO "Artist" (id, mbid, name, "sortName", type, country, disambiguation, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  a.gid::text,
  a.name,
  a.sort_name,
  at.name,
  iso.code,
  a.comment,
  NOW(),
  NOW()
FROM mb_staging.artist a
LEFT JOIN mb_staging.artist_type at ON at.id = a.type
LEFT JOIN mb_staging.iso_3166_1 iso ON iso.area = a.area
ON CONFLICT (mbid) DO NOTHING;

-- Transform Recordings
INSERT INTO "Recording" (id, mbid, title, length, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  r.gid::text,
  r.name,
  r.length,
  NOW(),
  NOW()
FROM mb_staging.recording r
ON CONFLICT (mbid) DO NOTHING;

-- Transform Release Groups
INSERT INTO "ReleaseGroup" (id, mbid, title, type, "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  rg.gid::text,
  rg.name,
  CASE rg.type
    WHEN 1 THEN 'Album'
    WHEN 2 THEN 'Single'
    WHEN 3 THEN 'EP'
    WHEN 4 THEN 'Broadcast'
    WHEN 5 THEN 'Other'
    ELSE 'Other'
  END,
  NOW(),
  NOW()
FROM mb_staging.release_group rg
ON CONFLICT (mbid) DO NOTHING;

-- Transform Releases
INSERT INTO "Release" (id, mbid, title, "releaseGroupId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  rel.gid::text,
  rel.name,
  sg_rg.id,
  NOW(),
  NOW()
FROM mb_staging.release rel
JOIN mb_staging.release_group rg ON rg.id = rel.release_group
JOIN "ReleaseGroup" sg_rg ON sg_rg.mbid = rg.gid::text
ON CONFLICT (mbid) DO NOTHING;

-- Transform Sample Relations (l_recording_recording)
-- link_type for 'samples material' is typically 69 in MB
INSERT INTO "SampleRelation" (id, "samplingTrackId", "sampledTrackId")
SELECT
  gen_random_uuid()::text,
  sg_r1.id,
  sg_r2.id
FROM mb_staging.l_recording_recording lrr
JOIN mb_staging.link l ON l.id = lrr.link
JOIN mb_staging.link_type lt ON lt.id = l.link_type
JOIN mb_staging.recording r1 ON r1.id = lrr.entity0
JOIN mb_staging.recording r2 ON r2.id = lrr.entity1
JOIN "Recording" sg_r1 ON sg_r1.mbid = r1.gid::text
JOIN "Recording" sg_r2 ON sg_r2.mbid = r2.gid::text
WHERE lt.name IN ('samples material', 'DJ-mix of', 'mashes up')
ON CONFLICT ("samplingTrackId", "sampledTrackId") DO NOTHING;

-- Transform Credits (l_artist_recording → producer, engineer, etc.)
INSERT INTO "Credit" (id, "artistId", "recordingId", role)
SELECT
  gen_random_uuid()::text,
  sg_a.id,
  sg_r.id,
  lt.name
FROM mb_staging.l_artist_recording lar
JOIN mb_staging.link l ON l.id = lar.link
JOIN mb_staging.link_type lt ON lt.id = l.link_type
JOIN mb_staging.artist a ON a.id = lar.entity0
JOIN mb_staging.recording r ON r.id = lar.entity1
JOIN "Artist" sg_a ON sg_a.mbid = a.gid::text
JOIN "Recording" sg_r ON sg_r.mbid = r.gid::text
WHERE lt.entity_type0 = 'artist' AND lt.entity_type1 = 'recording'
ON CONFLICT ("artistId", "recordingId", role) DO NOTHING;

-- Transform Artist Credits (performer relationship via artist_credit)
INSERT INTO "Credit" (id, "artistId", "recordingId", role)
SELECT
  gen_random_uuid()::text,
  sg_a.id,
  sg_r.id,
  'performer'
FROM mb_staging.artist_credit_name acn
JOIN mb_staging.recording r ON r.artist_credit = acn.artist_credit
JOIN mb_staging.artist a ON a.id = acn.artist
JOIN "Artist" sg_a ON sg_a.mbid = a.gid::text
JOIN "Recording" sg_r ON sg_r.mbid = r.gid::text
ON CONFLICT ("artistId", "recordingId", role) DO NOTHING;

-- Transform Tags
INSERT INTO "ArtistTag" (id, "artistId", tag, count)
SELECT
  gen_random_uuid()::text,
  sg_a.id,
  t.name,
  at.count
FROM mb_staging.artist_tag at
JOIN mb_staging.tag t ON t.id = at.tag
JOIN mb_staging.artist a ON a.id = at.artist
JOIN "Artist" sg_a ON sg_a.mbid = a.gid::text
WHERE at.count > 0
ON CONFLICT ("artistId", tag) DO NOTHING;

INSERT INTO "RecordingTag" (id, "recordingId", tag, count)
SELECT
  gen_random_uuid()::text,
  sg_r.id,
  t.name,
  rt.count
FROM mb_staging.recording_tag rt
JOIN mb_staging.tag t ON t.id = rt.tag
JOIN mb_staging.recording r ON r.id = rt.recording
JOIN "Recording" sg_r ON sg_r.mbid = r.gid::text
WHERE rt.count > 0
ON CONFLICT ("recordingId", tag) DO NOTHING;

-- Transform ISRCs (for Spotify cross-reference)
UPDATE "Recording" SET isrc = sub.isrc
FROM (
  SELECT DISTINCT ON (r.gid) r.gid, i.isrc
  FROM mb_staging.isrc i
  JOIN mb_staging.recording r ON r.id = i.recording
  ORDER BY r.gid, i.id
) sub
JOIN "Recording" sg_r ON sg_r.mbid = sub.gid::text
WHERE "Recording".id = sg_r.id AND "Recording".isrc IS NULL;

-- Transform Artist Aliases
INSERT INTO "ArtistAlias" (id, "artistId", name, locale)
SELECT
  gen_random_uuid()::text,
  sg_a.id,
  aa.name,
  aa.locale
FROM mb_staging.artist_alias aa
JOIN mb_staging.artist a ON a.id = aa.artist
JOIN "Artist" sg_a ON sg_a.mbid = a.gid::text
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_artist ON "Credit"("artistId");
CREATE INDEX IF NOT EXISTS idx_credit_recording ON "Credit"("recordingId");
CREATE INDEX IF NOT EXISTS idx_sample_sampling ON "SampleRelation"("samplingTrackId");
CREATE INDEX IF NOT EXISTS idx_sample_sampled ON "SampleRelation"("sampledTrackId");

TRANSFORM_SQL

echo "→ Transformation complete. Final counts:"
sudo -u postgres psql soundgraph -c "
SELECT 'Artist' as tbl, count(*) FROM \"Artist\"
UNION ALL SELECT 'Recording', count(*) FROM \"Recording\"
UNION ALL SELECT 'ReleaseGroup', count(*) FROM \"ReleaseGroup\"
UNION ALL SELECT 'SampleRelation', count(*) FROM \"SampleRelation\"
UNION ALL SELECT 'Credit', count(*) FROM \"Credit\"
UNION ALL SELECT 'ArtistTag', count(*) FROM \"ArtistTag\"
UNION ALL SELECT 'RecordingTag', count(*) FROM \"RecordingTag\"
ORDER BY 1;
"

# 9. Cleanup
echo "→ Cleaning up temporary files..."
# Keep staging schema for now (useful for debugging)
# rm -rf "$WORK_DIR"

echo ""
echo "=========================================="
echo "  MusicBrainz Import Complete!"
echo "=========================================="
echo "  Your SoundGraph database is now populated"
echo "  with the full MusicBrainz dataset."
echo "=========================================="
