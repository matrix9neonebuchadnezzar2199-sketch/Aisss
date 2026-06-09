-- M3: extracted text layer for attachment processing

CREATE TABLE IF NOT EXISTS extracted_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases (id) ON DELETE CASCADE,
  attachment_id UUID REFERENCES attachments (id) ON DELETE CASCADE,
  standalone_file_id UUID,
  source_type TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'ja',
  extraction_engine TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracted_texts_attachment
  ON extracted_texts (attachment_id)
  WHERE attachment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_extracted_texts_case
  ON extracted_texts (case_id)
  WHERE case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_pending_extraction
  ON jobs (status, job_type)
  WHERE status = 'pending';
