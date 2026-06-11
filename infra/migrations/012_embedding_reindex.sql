-- Embed モデル blue-green 切替と reindex 進捗管理

CREATE TABLE IF NOT EXISTS embedding_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name      TEXT NOT NULL,
  dimensions      INTEGER,
  collection_name TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'building'
                  CHECK (status IN ('building', 'active', 'retired', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reindex_jobs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_config_id   UUID NOT NULL REFERENCES embedding_configs (id),
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total_chunks       INTEGER NOT NULL DEFAULT 0,
  processed_chunks   INTEGER NOT NULL DEFAULT 0,
  failed_chunks      INTEGER NOT NULL DEFAULT 0,
  error_message      TEXT,
  started_at         TIMESTAMPTZ,
  finished_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reindex_jobs_status_created
  ON reindex_jobs (status, created_at DESC);

-- 既存稼働コレクションを active として登録
INSERT INTO embedding_configs (model_name, dimensions, collection_name, status, activated_at)
SELECT
  COALESCE(
    (SELECT model_name FROM ollama_model_roles WHERE is_default_embedding = TRUE LIMIT 1),
    'unknown'
  ),
  NULL,
  'aisss_chunks',
  'active',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM embedding_configs WHERE collection_name = 'aisss_chunks'
);
