# Foundation Materials

## Purpose

Before implementation, Aisss needs more than code. It needs operational definitions, master data rules, permission rules, templates, and verification data. This document lists the baseline materials that should be prepared early.

## Required Operational Documents

| Material | Purpose | Owner |
|---|---|---|
| Field definition sheet | Defines every case field, required status, examples, and validation rules. | Product/operator lead. |
| Master data policy | Defines who can add/edit master values and which values are strict. | Operations. |
| Viewing range policy | Defines groups, access scopes, and default visibility. | Security/operations. |
| Handling condition policy | Defines AI/search/export behavior for each condition. | Security/operations. |
| Retention policy | Defines 保存期間 values and deletion/archive behavior. | Records management. |
| Excel template guide | Shows how to fill bulk import files. | Product/operator lead. |
| AI usage policy | Defines allowed questions, citation rules, and export restrictions. | Security/operations. |
| Audit review runbook | Defines who reviews logs and when. | Operations/security. |

## Initial Master Data

Prepare initial values for:

- 資料区分.
- 登録部署.
- 分類.
- 地域.
- 資料源.
- 対応情報要求.
- 条件.
- 閲覧範囲.
- 取扱区分.
- 信頼性.
- 正確性.
- ランク.
- 保存期間.
- 情報入手場所.

For each value, define:

- Display name.
- Code if needed.
- Description.
- Active status.
- Sort order.
- Whether operators may add values during import.

## Handling Condition Matrix

The initial matrix should include at least:

| Condition | Search Policy | Quote Policy | Export Policy | Notes |
|---|---|---|---|---|
| 印刷禁止 | allow | allow | deny_print | Disable print/PDF export. |
| 複製禁止 | allow | summarize_only | deny_copy | Avoid long verbatim reproduction. |
| 照会禁止 | deny | deny | deny_all | Exclude from RAG by default. |
| 特定経路による情報提供禁止 | restricted | deny for target channel | deny_all for target channel | Requires channel definition. |

This matrix should become seed data for `conditions`.

## Excel Template Materials

Create:

- `Cases` input sheet.
- `Masters` reference sheet.
- `Conditions` reference sheet.
- `ViewingRanges` reference sheet.
- `Instructions` sheet.
- Sample valid workbook.
- Sample invalid workbook for test cases.

The template should include a visible version number. Import code should reject unsupported template versions or map them explicitly.

## Test Data

Prepare synthetic test data:

- Public case.
- Department-only case.
- 담당者-only case.
- Case with 印刷禁止.
- Case with 複製禁止.
- Case with 照会禁止.
- Case with multiple overlapping conditions.
- Case with Office attachment.
- Case with PDF attachment.
- Case with image OCR attachment.
- Case with audio ASR transcript.
- Excel import file with mixed valid and invalid rows.

Do not use real sensitive documents for development tests.

## Permission Test Scenarios

Minimum scenarios:

- User in no allowed group cannot view restricted case.
- User in allowed group can view restricted case.
- Operator can manage master values but cannot view unrelated restricted content unless explicitly authorized.
- AI query excludes cases outside viewing range.
- AI query excludes 照会禁止 cases.
- AI answer does not include long verbatim text from 複製禁止 cases.
- Print/export is disabled when 印刷禁止 applies.
- Permission update changes AI search result behavior.

## Recommended ADRs

Already created:

- [ADR-001: Primary Architecture](./decisions/ADR-001-primary-architecture.md)
- [ADR-002: RAG Permission Middleware](./decisions/ADR-002-rag-permission-middleware.md)

Future ADR candidates:

- Backend framework choice.
- Vector database choice.
- OCR engine choice.
- ASR engine choice.
- Authentication provider.
- Excel template versioning strategy.

## Runbooks to Create Later

- Local development setup.
- Backup and restore.
- Reindex all RAG chunks.
- Recover failed extraction jobs.
- Rotate Dify and object storage credentials.
- Add a new viewing range.
- Respond to suspected AI permission leakage.

## Definition of Ready for Coding

Implementation is ready to start when:

- MVP scope is selected from [Milestones](./11-milestones.md).
- Initial master data is available.
- Viewing range and condition policies are approved.
- Local stack choices are made.
- Synthetic test data is prepared.
- The first migration plan is agreed.
