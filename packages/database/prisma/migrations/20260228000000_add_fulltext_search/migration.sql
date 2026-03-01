-- Enable pg_trgm for fuzzy/typo-tolerant search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- Artist: add search_vector column + GIN index + trigger
-- ============================================================

ALTER TABLE "Artist" ADD COLUMN "search_vector" tsvector;

UPDATE "Artist"
SET "search_vector" =
  setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("sortName", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("disambiguation", '')), 'C');

CREATE INDEX "Artist_search_vector_idx" ON "Artist" USING GIN ("search_vector");
CREATE INDEX "Artist_name_trgm_idx" ON "Artist" USING GIN ("name" gin_trgm_ops);

CREATE OR REPLACE FUNCTION artist_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('english', coalesce(NEW."name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."sortName", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."disambiguation", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Artist_search_vector_trigger"
  BEFORE INSERT OR UPDATE OF "name", "sortName", "disambiguation"
  ON "Artist"
  FOR EACH ROW
  EXECUTE FUNCTION artist_search_vector_update();

-- ============================================================
-- Recording: add search_vector column + GIN index + trigger
-- ============================================================

ALTER TABLE "Recording" ADD COLUMN "search_vector" tsvector;

UPDATE "Recording"
SET "search_vector" = to_tsvector('english', coalesce("title", ''));

CREATE INDEX "Recording_search_vector_idx" ON "Recording" USING GIN ("search_vector");
CREATE INDEX "Recording_title_trgm_idx" ON "Recording" USING GIN ("title" gin_trgm_ops);

CREATE OR REPLACE FUNCTION recording_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := to_tsvector('english', coalesce(NEW."title", ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Recording_search_vector_trigger"
  BEFORE INSERT OR UPDATE OF "title"
  ON "Recording"
  FOR EACH ROW
  EXECUTE FUNCTION recording_search_vector_update();
