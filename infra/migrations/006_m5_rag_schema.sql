-- M5: RAG schema — standalone files, chunks, sync state, attachment RAG flags

CREATE TABLE IF NOT EXISTS standalone_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  genre TEXT NOT NULL DEFAULT 'standalone_reference',
  file_name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  content_type TEXT,
  file_size BIGINT,
  sha256 TEXT,
  registered_by UUID REFERENCES users (id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  extraction_error TEXT,
  rag_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS standalone_file_viewing_ranges (
  standalone_file_id UUID NOT NULL REFERENCES standalone_files (id) ON DELETE CASCADE,
  viewing_range_id UUID NOT NULL REFERENCES viewing_ranges (id),
  PRIMARY KEY (standalone_file_id, viewing_range_id)
);

CREATE TABLE IF NOT EXISTS standalone_file_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standalone_file_id UUID NOT NULL REFERENCES standalone_files (id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_standalone_files_deleted
  ON standalone_files (deleted_at)
  WHERE deleted_at IS NULL;

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS rag_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE extracted_texts
  ADD CONSTRAINT fk_extracted_standalone_file
  FOREIGN KEY (standalone_file_id) REFERENCES standalone_files (id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases (id) ON DELETE CASCADE,
  attachment_id UUID REFERENCES attachments (id) ON DELETE CASCADE,
  standalone_file_id UUID REFERENCES standalone_files (id) ON DELETE CASCADE,
  extracted_text_id UUID REFERENCES extracted_texts (id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  chunk_text TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_case ON rag_chunks (case_id) WHERE case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rag_chunks_attachment ON rag_chunks (attachment_id) WHERE attachment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rag_chunks_standalone ON rag_chunks (standalone_file_id) WHERE standalone_file_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS rag_sync_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES rag_chunks (id) ON DELETE CASCADE,
  vector_collection TEXT NOT NULL DEFAULT 'aisss_chunks',
  vector_point_id TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_sync_chunk ON rag_sync_states (chunk_id);
CREATE INDEX IF NOT EXISTS idx_jobs_pending_embedding
  ON jobs (status, job_type)
  WHERE status = 'pending' AND job_type = 'embedding';

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value_json)
VALUES ('rag', '{"rerank_enabled": false, "chunk_size": 2000, "chunk_overlap": 200}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Align 照会禁止 with deny-at-retrieval policy (docs/06)
UPDATE conditions
SET search_policy = 'deny', quote_policy = 'deny'
WHERE name = '照会禁止' AND search_policy <> 'deny';

INSERT INTO ollama_model_roles (model_name, roles, enabled_for_chat, is_default_chat, is_default_embedding, is_rerank)
VALUES
  ('nomic-embed-text:latest', ARRAY['embedding'], FALSE, FALSE, TRUE, FALSE),
  ('llama3.2:latest', ARRAY['chat'], TRUE, TRUE, FALSE, FALSE)
ON CONFLICT (model_name) DO NOTHING;
