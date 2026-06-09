-- M4: Excel import preview and confirmed import runs

CREATE TABLE IF NOT EXISTS excel_import_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id),
  file_name TEXT NOT NULL,
  rows_json JSONB NOT NULL,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_excel_import_previews_expires
  ON excel_import_previews (expires_at);

CREATE TABLE IF NOT EXISTS excel_import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preview_id UUID NOT NULL REFERENCES excel_import_previews (id),
  user_id UUID NOT NULL REFERENCES users (id),
  status TEXT NOT NULL DEFAULT 'completed',
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  row_results_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
