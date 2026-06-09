-- M6/M7: operational hardening and pilot tracking

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_dead_letter
  ON jobs (dead_lettered_at DESC)
  WHERE status = 'dead_letter';

CREATE INDEX IF NOT EXISTS idx_jobs_type_status_updated
  ON jobs (job_type, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS backup_restore_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_by UUID REFERENCES users (id),
  scope TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pilot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID REFERENCES users (id),
  area TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_status
  ON pilot_feedback (status, created_at DESC);

INSERT INTO groups (id, name)
VALUES ('b1000000-0000-4000-8000-000000000003', 'パイロット利用者')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, external_id, display_name, department_id, role)
VALUES (
  '00000000-0000-4000-8000-000000000003',
  'pilot-user',
  'パイロット利用者',
  'a1000000-0000-4000-8000-000000000001',
  'operator'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_groups (user_id, group_id)
VALUES
  ('00000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003')
ON CONFLICT DO NOTHING;

INSERT INTO group_viewing_ranges (group_id, viewing_range_id)
VALUES
  ('b1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings (key, value_json)
VALUES (
  'pilot',
  '{
    "status": "ready_for_limited_pilot",
    "pilot_group_id": "b1000000-0000-4000-8000-000000000003",
    "known_limitations": [
      "OCR/ASR engines are still stubs",
      "RAG admin tree cascade is basic",
      "AI chat streaming API exists; WebUI uses non-streaming response"
    ]
  }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  value_json = EXCLUDED.value_json,
  updated_at = NOW();
