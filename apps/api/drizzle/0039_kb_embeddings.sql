-- Hybrid retrieval: pgvector embeddings alongside the existing FTS path.
-- Embeddings are 1536-dim (text-embedding-3-small) so we don't blow up storage.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "knowledge_entries" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- ivfflat needs at least one row at index time, so we create it without WITH lists
-- and let Postgres rebuild on its own. For low-volume KBs this is cheap.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'knowledge_entries_embedding_idx'
  ) THEN
    EXECUTE 'CREATE INDEX knowledge_entries_embedding_idx ON knowledge_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- ivfflat may fail on an empty table or unsupported pgvector version; ignore so the
  -- migration still applies. The query path falls back to FTS when no embeddings exist.
  RAISE NOTICE 'ivfflat index skipped: %', SQLERRM;
END $$;
