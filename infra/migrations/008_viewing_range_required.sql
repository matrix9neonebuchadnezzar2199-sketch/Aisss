-- M8: make case viewing ranges explicit and seed safe defaults.

INSERT INTO viewing_ranges (id, code, name, sort_order)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'all', '全員', 1),
  ('c1000000-0000-4000-8000-000000000003', 'admin_only', '管理者のみ', 0)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_viewing_ranges_code_unique
  ON viewing_ranges (code)
  WHERE code IS NOT NULL;

INSERT INTO case_viewing_ranges (case_id, viewing_range_id)
SELECT c.id, 'c1000000-0000-4000-8000-000000000003'
FROM cases c
WHERE NOT EXISTS (
  SELECT 1 FROM case_viewing_ranges cvr WHERE cvr.case_id = c.id
)
ON CONFLICT DO NOTHING;
