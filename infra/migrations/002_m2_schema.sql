-- M2: masters, extended cases, permissions, audit, jobs, attachments

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS information_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handling_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reliability_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accuracy_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rank_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS acquisition_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS viewing_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  search_policy TEXT NOT NULL DEFAULT 'allow',
  quote_policy TEXT NOT NULL DEFAULT 'allow',
  export_policy TEXT NOT NULL DEFAULT 'allow',
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'operator';

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS registering_department_id UUID REFERENCES departments (id),
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories (id),
  ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions (id),
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES sources (id),
  ADD COLUMN IF NOT EXISTS registrant_id UUID REFERENCES persons (id),
  ADD COLUMN IF NOT EXISTS information_request_id UUID REFERENCES information_requests (id),
  ADD COLUMN IF NOT EXISTS handling_type_id UUID REFERENCES handling_types (id),
  ADD COLUMN IF NOT EXISTS reliability_id UUID REFERENCES reliability_levels (id),
  ADD COLUMN IF NOT EXISTS accuracy_id UUID REFERENCES accuracy_levels (id),
  ADD COLUMN IF NOT EXISTS rank_id UUID REFERENCES rank_levels (id),
  ADD COLUMN IF NOT EXISTS retention_policy_id UUID REFERENCES retention_policies (id),
  ADD COLUMN IF NOT EXISTS classification_number TEXT,
  ADD COLUMN IF NOT EXISTS action_taken TEXT,
  ADD COLUMN IF NOT EXISTS condition_notes TEXT,
  ADD COLUMN IF NOT EXISTS viewing_range_note TEXT,
  ADD COLUMN IF NOT EXISTS note_1 TEXT,
  ADD COLUMN IF NOT EXISTS note_2 TEXT,
  ADD COLUMN IF NOT EXISTS note_3 TEXT,
  ADD COLUMN IF NOT EXISTS note_4 TEXT,
  ADD COLUMN IF NOT EXISTS note_5 TEXT,
  ADD COLUMN IF NOT EXISTS note_6 TEXT;

CREATE TABLE IF NOT EXISTS case_conditions (
  case_id UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  condition_id UUID NOT NULL REFERENCES conditions (id),
  PRIMARY KEY (case_id, condition_id)
);

CREATE TABLE IF NOT EXISTS case_viewing_ranges (
  case_id UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  viewing_range_id UUID NOT NULL REFERENCES viewing_ranges (id),
  PRIMARY KEY (case_id, viewing_range_id)
);

CREATE TABLE IF NOT EXISTS case_keywords (
  case_id UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES keywords (id),
  PRIMARY KEY (case_id, keyword_id)
);

CREATE TABLE IF NOT EXISTS group_viewing_ranges (
  group_id UUID NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  viewing_range_id UUID NOT NULL REFERENCES viewing_ranges (id),
  PRIMARY KEY (group_id, viewing_range_id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_key TEXT,
  content_type TEXT,
  file_size BIGINT,
  sha256 TEXT,
  attachment_kind TEXT NOT NULL DEFAULT 'other',
  uploaded_by UUID REFERENCES users (id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  extraction_error TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users (id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  case_display_id TEXT,
  query_id TEXT,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_case_display_id ON audit_logs (case_display_id);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  case_id UUID REFERENCES cases (id),
  case_display_id TEXT,
  attachment_id UUID REFERENCES attachments (id),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_cases_search ON cases (event_start_date, material_type_id, registering_department_id, rank_id);

CREATE TABLE IF NOT EXISTS ollama_model_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL UNIQUE,
  roles TEXT[] NOT NULL DEFAULT '{}',
  enabled_for_chat BOOLEAN NOT NULL DEFAULT FALSE,
  is_default_chat BOOLEAN NOT NULL DEFAULT FALSE,
  is_default_embedding BOOLEAN NOT NULL DEFAULT FALSE,
  is_rerank BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
