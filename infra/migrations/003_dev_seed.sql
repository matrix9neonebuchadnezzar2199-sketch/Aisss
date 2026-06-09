-- Dev seed data (idempotent). Safe to re-run on fresh DB only.

INSERT INTO departments (id, code, name, sort_order)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'dept-1', '分析第一課', 1),
  ('a1000000-0000-4000-8000-000000000002', 'dept-2', '分析第二課', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, external_id, display_name, department_id, role)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'dev-admin', '開発管理者', 'a1000000-0000-4000-8000-000000000001', 'admin'),
  ('00000000-0000-4000-8000-000000000002', 'dev-analyst', '分析担当者', 'a1000000-0000-4000-8000-000000000001', 'operator')
ON CONFLICT (id) DO NOTHING;

INSERT INTO groups (id, name)
VALUES
  ('b1000000-0000-4000-8000-000000000001', '管理者'),
  ('b1000000-0000-4000-8000-000000000002', '分析担当')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_groups (user_id, group_id)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO viewing_ranges (id, code, name, sort_order)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'all', '全員', 1),
  ('c1000000-0000-4000-8000-000000000002', 'analyst', '分析担当者のみ', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO group_viewing_ranges (group_id, viewing_range_id)
VALUES
  ('b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002'),
  ('b1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO material_types (id, code, name, sort_order)
VALUES
  ('d1000000-0000-4000-8000-000000000001', 'report', '報告書', 1),
  ('d1000000-0000-4000-8000-000000000002', 'case', 'ケース', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, sort_order) VALUES
  ('e1000000-0000-4000-8000-000000000001', '地政学', 1),
  ('e1000000-0000-4000-8000-000000000002', '経済', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO regions (id, name, sort_order) VALUES
  ('f1000000-0000-4000-8000-000000000001', '東アジア', 1),
  ('f1000000-0000-4000-8000-000000000002', '東南アジア', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sources (id, name, sort_order) VALUES
  ('g1000000-0000-4000-8000-000000000001', '公開情報', 1),
  ('g1000000-0000-4000-8000-000000000002', '内部資料', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO handling_types (id, name, sort_order) VALUES
  ('h1000000-0000-4000-8000-000000000001', '通常', 1),
  ('h1000000-0000-4000-8000-000000000002', '機微', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO reliability_levels (id, name, sort_order) VALUES
  ('i1000000-0000-4000-8000-000000000001', '高', 1),
  ('i1000000-0000-4000-8000-000000000002', '中', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO accuracy_levels (id, name, sort_order) VALUES
  ('j1000000-0000-4000-8000-000000000001', '確認済', 1),
  ('j1000000-0000-4000-8000-000000000002', '未確認', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rank_levels (id, name, sort_order) VALUES
  ('k1000000-0000-4000-8000-000000000001', 'A', 1),
  ('k1000000-0000-4000-8000-000000000002', 'B', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO conditions (id, name, search_policy, quote_policy, export_policy, priority)
VALUES
  ('l1000000-0000-4000-8000-000000000001', '印刷禁止', 'allow', 'allow', 'deny_print', 10),
  ('l1000000-0000-4000-8000-000000000002', '複製禁止', 'allow', 'allow', 'deny_copy', 10),
  ('l1000000-0000-4000-8000-000000000003', '照会禁止', 'restricted', 'summarize_only', 'deny_all', 20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO cases (
  id, display_id, material_number, title, summary,
  body_summary, body_article, body_assessment, body_reference,
  event_start_date, event_end_date,
  material_type_id, registering_department_id, category_id, region_id, source_id,
  handling_type_id, reliability_id, accuracy_id, rank_id,
  classification_number, created_by, updated_by
)
VALUES
  (
    'm1000000-0000-4000-8000-000000000142',
    'CASE-2026-00142',
    'DOC-2026-0042',
    '東アジア情勢に関する月次分析（2026年1月）',
    '東アジアにおける主要国の政策動向を整理し、今後3ヶ月の注目点を示す。',
    '東アジアにおける主要国の政策動向を整理し、今後3ヶ月の注目点を示す。',
    '各国首脳会談の結果、貿易協定の再交渉が進行中である。',
    '短期的には安定、中期的に不確実性が残る。',
    '',
    '2026-01-01', '2026-01-31',
    'd1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000001',
    'g1000000-0000-4000-8000-000000000001',
    'h1000000-0000-4000-8000-000000000001',
    'i1000000-0000-4000-8000-000000000001',
    'j1000000-0000-4000-8000-000000000001',
    'k1000000-0000-4000-8000-000000000001',
    'CLS-2026-142',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    'm1000000-0000-4000-8000-000000000138',
    'CASE-2026-00138',
    'DOC-2026-0038',
    '〇〇地域経済動向レポート',
    '地域経済の四半期動向と主要リスク要因の整理。',
    '地域経済の四半期動向と主要リスク要因の整理。',
    '輸出・観光・製造業の指標を横断的に比較。',
    '為替変動の影響が顕在化。',
    '',
    '2026-01-05', '2026-01-08',
    'd1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000002',
    'g1000000-0000-4000-8000-000000000002',
    'h1000000-0000-4000-8000-000000000002',
    'i1000000-0000-4000-8000-000000000002',
    'j1000000-0000-4000-8000-000000000002',
    'k1000000-0000-4000-8000-000000000002',
    'CLS-2026-138',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO case_viewing_ranges (case_id, viewing_range_id)
VALUES
  ('m1000000-0000-4000-8000-000000000142', 'c1000000-0000-4000-8000-000000000001'),
  ('m1000000-0000-4000-8000-000000000138', 'c1000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO case_conditions (case_id, condition_id)
VALUES
  ('m1000000-0000-4000-8000-000000000138', 'l1000000-0000-4000-8000-000000000003')
ON CONFLICT DO NOTHING;
