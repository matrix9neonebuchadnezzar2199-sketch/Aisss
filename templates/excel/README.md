# AISSS Excel Case Import Template

Version: `aisss-cases-v1`

## Sheet: Cases

Use the downloadable template from `GET /api/imports/excel/template` or the column headers below.

| Column | Required | Notes |
|---|---|---|
| `case_uuid` | No | Update existing case when set |
| `display_id` | No | Reference only (not written) |
| `title` | **Yes** | 表題 |
| `material_number` | No | 資料番号 |
| `summary` | No | 要約 |
| `body_summary` | No | 本文 1 |
| `body_article` | No | 本文 2 |
| `body_assessment` | No | 本文 3 |
| `body_reference` | No | 本文 4 |
| `event_start_date` | No | `YYYY-MM-DD` |
| `event_end_date` | No | `YYYY-MM-DD`, must be >= start |
| `material_type` | No | Master **name** (strict) |
| `registering_department` | No | Master name (strict) |
| `category` | No | Master name (strict) |
| `region` | No | Master name (strict) |
| `source` | No | Master name (strict) |
| `handling_type` | No | Master name (strict) |
| `reliability` | No | Master name (strict) |
| `accuracy` | No | Master name (strict) |
| `rank` | No | Master name (strict) |
| `viewing_ranges` | **Yes** | Semicolon-separated master names |
| `conditions` | No | Semicolon-separated condition names |
| `classification_number` | No | 分類番号 |
| `keyword1` … `keyword6` | No | Auto-created on confirm if new |
| `note1` … `note6` | No | 備考 |
| `action_taken` | No | 処置 |
| `condition_notes` | No | 条件（その他） |
| `viewing_range_note` | No | 閲覧範囲（直接入力） |

## Flow

1. `POST /api/imports/excel/preview` — parse and validate (no DB writes for cases)
2. Review row errors in WebUI
3. `POST /api/imports/excel/{preview_id}/confirm` — commit valid rows only
