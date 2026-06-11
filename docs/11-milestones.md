# Milestones

> Mock coverage per milestone: [WebUI Mock Inventory and Flows](./18-webui-mock-inventory-and-flows.md#screen-completeness-matrix).

## Milestone 0: Design Baseline

Goal: Make implementation decisions explicit before coding.

Deliverables:

- Requirements document.
- Overall architecture.
- Data model draft.
- RAG permission design.
- Ingestion design.
- WebUI and API boundary.
- ADRs.

Done when:

- Case fields are represented in the data model.
- RAG permission approach is approved.
- MVP scope is understood by implementers.

**Mock coverage:** `webui.html` + `case-detail.html` define UI boundaries; [18](./18-webui-mock-inventory-and-flows.md) inventories screens and flows.

## Milestone 1: Repository and Development Environment

Goal: Prepare a runnable project skeleton.

Deliverables:

- Repository structure.
- Backend skeleton.
- WebUI skeleton.
- Database migration setup.
- Local Docker Compose for PostgreSQL, object storage, queue, and vector DB.
- Host Ollama connectivity documented and verifiable via `GET /api/ollama/health`.
- `.env.example`.
- Basic CI for lint and tests.

Done when:

- A developer can start the local stack from documented commands.
- Empty WebUI and API health checks run.
- Initial migrations apply successfully.

**Implementation:** M1 skeleton + M2 case API (`GET/POST/PATCH/DELETE /api/cases`), masters, permissions, audit, jobs stub; Web search/register/detail wired to API. Placeholder auth: `X-AISSS-User-Id` / `DEV_USER_ID`.

## Milestone 2: Case Management MVP

Goal: Register, edit, view, and search cases without AI.

Deliverables:

- Case create/edit/detail screens.
- Master list management.
- User/group/viewing range basics.
- Case metadata search.
- Audit logs for case and master changes.

Done when:

- Required case fields can be stored and edited.
- Viewing ranges prevent unauthorized case detail access.
- Operators can add master values from WebUI.

**Mock coverage:** Search (4-row collapsible filter), register (vertical body stack; 記事 emphasized), detail, edit (`?edit=`), masters (stub), permissions (tabs). Audit log and job status **UI mocks exist** (filters, tables, cross-links); live `GET /api/audit-logs` / job polling remain M6.

## Milestone 3: Attachment and Extraction MVP

Goal: Attach files and extract text asynchronously.

Deliverables:

- Attachment upload/download with permission checks.
- Object storage integration.
- Extraction worker for Office and PDF.
- OCR path for image/scanned PDF.
- ASR path for audio or manual transcript.
- Extraction status and retry UI.

Done when:

- Original files are stored outside PostgreSQL.
- Extracted text is linked to case and attachment.
- Failed extraction is visible and retryable.

**Implementation:** MinIO upload/download, `extracted_texts` table, extraction worker (PDF/TXT/DOCX; OCR/ASR stub), Web attachment panel with retry. **Mock coverage:** RAG row **再抽出** still links to jobs view.

**Done when (progress):** originals in object storage; extracted text linked; failed extraction visible and retryable via API/UI.

## Milestone 4: Excel Import

Goal: Support bulk registration using controlled templates.

Deliverables:

- Excel template.
- Import preview.
- Validation rules.
- Confirmed import.
- Row-level error reporting.
- Import audit logs.

Done when:

- Valid rows create or update cases.
- Invalid rows are rejected with actionable messages.
- Master strictness rules are enforced.

**Implementation:** `POST /api/imports/excel/preview`, `.../confirm`, template download, row validation (strict masters), keyword auto-create on confirm, Web preview/confirm on register screen.

**Mock coverage:** Static mock still uses autofill toast; live WebUI uses API flow above.

## Milestone 5: Permissioned RAG MVP

Goal: Enable AI question answering without leaking restricted cases.

Deliverables:

- Chunking and embedding jobs.
- Vector database integration.
- Permissioned search middleware.
- `/api/ai/chat` with permissioned search and Ollama completion.
- AI search UI with model selector and Ollama health indicator.
- RAG admin and model management screens.
- Optional ReRank configuration (default off).
- Citation display.
- Handling-condition output restrictions.

Done when:

- Unauthorized users cannot retrieve restricted chunks.
- `照会禁止` cases are excluded from AI answers.
- AI answers cite only allowed cases.
- Permission changes update RAG behavior.

**Implementation:** `006_m5_rag_schema.sql`; Qdrant upsert + Ollama embeddings worker; `POST /api/rag/search`, `/api/ai/chat` (+ SSE stream), `/api/rag/*`, `PUT /api/admin/ollama/model-roles`; Web `/ai`, `/rag`, `/models`, standalone registration. ReRank stored but default off.

**Mock coverage:** Live React pages replace static AI/RAG/models demos; HTML mock remains reference for tree cascade polish.

## Milestone 6: Operational Hardening

Goal: Prepare for real multi-user operation.

Deliverables:

- Full audit log views.
- Backup and restore procedures.
- Permission regression tests.
- Job retry and dead-letter handling.
- Admin dashboards.
- Security review of storage and RAG boundaries.

Done when:

- Operators can monitor failed jobs.
- Backup restore is tested.
- Permission tests cover major access paths.

**Implementation:** `007_m6_m7_ops_pilot.sql`; audit filters + CSV export; job stats, retry, and dead-letter APIs; `/jobs`, `/admin`, and enhanced `/audit` React pages; backup check API; permission role tests.

**Mock coverage:** 監査ログ and ジョブ状態 live React pages now cover the M6 operational subset. HTML mock remains reference for detail dialogs and richer cross-links.

## Milestone 7: Production Pilot

Goal: Pilot with limited users and real operational documents.

Deliverables:

- Pilot user group.
- Seeded master data.
- Initial Excel templates.
- Operational runbook.
- Feedback process.
- Known limitations list.

Done when:

- Pilot users can complete core workflows.
- Permission incidents are not observed in test cases.
- Feedback is triaged into post-MVP backlog.

**Pilot GO (2026-06-10):** Limited pilot approved after M18 dry-run (Steps 1–12), static-review hardening, CI integration gate, WebUI sign-off, and audit CSV UTF-8 BOM verification. See [Operational Runbook § Pilot Dry Run](./19-operational-runbook.md#pilot-dry-run-checklist) and [dev-diary.md § Pilot GO](./dev-diary.md).

**Implementation:** Pilot group/user seed in `007_m6_m7_ops_pilot.sql`; `/pilot` feedback workflow; [Operational Runbook](./19-operational-runbook.md); dashboard feedback metric; known limitations recorded in app settings and runbook.

## Milestone 19: WebUI Mock Visual Parity

Goal: Reproduce the HTML mock (`mockups/webui.html`, `case-detail.html`) look, navigation, and cross-links in the React WebUI while preserving API wiring.

Deliverables:

- Design tokens and component CSS ported from mock (shared class names).
- App shell: gh-header, hierarchical sidebar, collapse, Ollama badge.
- All 11 mock views + standalone case detail layout.
- Permissions screen (`/permissions`) matching mock tabs.
- [WebUI Wiring Checklist](./20-webui-wiring-checklist.md) signed off for Flow A/B/C.

Done when:

- Side-by-side visual review with mock passes for each screen.
- Cross-navigation (stats→jobs, jobs→audit, RAG→edit, search→detail new tab) works.
- Screen→API matrix in doc 20 verified for admin, operator, and pilot.

**Non-scope:** Full 17 search filters, all registration fields from spec 08, MAP search, AI streaming UI.

## Milestone 20: WebUI UX Stabilization / QA Closure

Goal: Fix and lock post-M19 UX regressions (AI chat history, RAG tree, admin filter parity) before expanding feature scope.

Deliverables:

- AI search chat persistence (`useAiChatHistory` hydration + functional updates), thinking spinner, chat-style bubbles.
- RAG admin left tree (`GET /api/rag/tree`), tree-driven file list filter, status marks (●/×/◐/◎/○), row/label coloring.
- RAG storage breakdown dashboard (`GET /api/rag/status` → `storage_breakdown`).
- Unified admin UI: `CollapsibleFilterPanel`, stats → panel → filter → table; sidebar collapse state lifted to `AppLayout`.
- Audit stats API (`GET /api/audit-logs/stats`) for dashboard cards.
- [WebUI Wiring Checklist § M20](./20-webui-wiring-checklist.md#m20-follow-up-regression) regression rows.
- Deploy verification gate (`verify-docker-deploy.ps1`) after web/api rebuild.

Done when:

- `npm run build -w @aisss/web` and `npm test -w @aisss/api` pass.
- Docker deploy verify passes for running containers.
- M20 regression checklist rows verified (manual or pilot environment).
- Changes committed; M19 persona walkthrough can proceed on stable baseline.

**Non-scope:** 17 search filters, full registration fields, AI streaming UI, MAP search.

**Deferred to M21:** RAG Admin Full Operations (delete dialog, viewing-range guard, sortable list, standalone range edit) or Search/Register Spec Completion — pick one after M20 sign-off.

## Milestone 21: RAG Admin Full Operations

Goal: Complete RAG 管理 operator workflows deferred from M20 (mock parity for delete, filters, sort, reindex, viewing-range UX).

Deliverables:

- Delete confirmation dialog + `DELETE /api/attachments/{id}` and `DELETE /api/rag/standalone-files/{id}` (Qdrant + chunks + storage cleanup).
- Case viewing-range guard dialog (redirect to case edit); standalone viewing-range `<select>` with immediate save.
- Tag filter, date range filter (`date_from` / `date_to` on `GET /api/rag/files`).
- Client-side sortable file list columns (file, viewing range, pipeline, RAG toggle).
- Bulk reindex (`POST /api/rag/bulk-reindex`) and per-case reindex (`POST /api/cases/{case_id}/reindex`).
- [WebUI Wiring Checklist § M21](./20-webui-wiring-checklist.md#m21-follow-up-regression) regression rows.

Done when:

- `npm run build -w @aisss/web` and `npm test -w @aisss/api` pass.
- Docker deploy verify passes after web/api rebuild.
- M21 regression checklist rows verified (manual or pilot environment).

**Non-scope:** 17 search filters, full registration fields, AI streaming UI, tag combobox with history, MAP search.

**Deferred to M22:** Search/Register Spec Completion (17 filters, registration fields, extracted-text preview on case detail).

## Milestone 22: Pilot Regression Closure

Goal: Close M20/M21 manual verification gaps and confirm RAG delete / permission / pipeline stability before feature expansion.

Deliverables:

- M20/M21 checklist sign-off with automated regression tests (`m22-regression.test.ts`).
- RAG delete FK cleanup (migration 010) verified.
- Extended case search filters and registration fields (foundation for M23).
- [WebUI Wiring Checklist § M22](./20-webui-wiring-checklist.md#m22-follow-up-regression).

Done when:

- Checklist rows recorded ok/warn/err.
- `npm test -w @aisss/api`, `npm run build -w @aisss/web`, Docker verify pass.

## Milestone 23: Search/Register Spec Completion

Goal: Align register, search, Excel import, and case detail with doc 08 field contract.

Deliverables:

- Registration fields: 備考1-6, keywords, 処置, 保存期間, 情報収集者, 情報入手場所, 対応情報要求, 資料登録者.
- Search 17 filters on `GET /api/cases` and Search UI.
- Excel template v2 (`aisss-cases-v2`) synced with API.
- Case detail extracted-text preview per attachment.
- Migration `011_case_collectors_acquisition.sql`.

Done when:

- Register/edit/search/Excel import field contracts match.
- Migrations apply without breaking existing cases.
- Search filter API tests cover primary combinations.

## Milestone 24: RAG Input Expansion

Goal: Broaden practical RAG source formats.

Deliverables:

- XLSX extraction in worker (`xlsx` engine).
- Transcript-first guidance for image/audio (OCR/ASR deferred).
- Clear extraction failure messages in RAG admin and attachment panel.

Done when:

- XLSX attachments extract real cell text (not stub).
- Image/audio failures guide operators to `.txt` transcript upload.
- Failed extraction retry/audit trail visible in jobs.

## Milestone 25: AI Search UX / Streaming / Policy Hardening

Goal: Production-grade AI search UI.

Deliverables:

- SSE streaming UI (`POST /api/ai/chat/stream`) with incremental render.
- Policy banner (quote/export) from `effective_policies`.
- Ollama down / no chat model disables composer with recovery hints.

Done when:

- Streaming and failure paths preserve chat history.
- Denied case titles do not leak in UI/audit/citations.
- Pilot permission regression passes.

## Milestone 26: Retrieval Quality / Evaluation Loop

Goal: Improve findability, not just permission safety.

Deliverables:

- Expanded `apps/api/eval/retrieval-eval-set.json` (10 pilot scenarios).
- DevLog/runbook notes for retrieval metrics.
- ReRank ON/OFF decision documented (execution remains OFF until model path wired).

Done when:

- 10+ scenarios with expected citations recorded.
- `npm test -- src/rag-eval.test.ts` passes on expanded set.
- ReRank policy explicit in runbook.

## Milestone 27: Operations / Backup / Governance Closure

Goal: Evidence for wider pilot go/no-go.

Deliverables:

- Qdrant rebuild runbook section.
- Backup-check workflow via `POST /api/admin/backup-checks`.
- Audit `details_json` governance notes.

Done when:

- PostgreSQL/MinIO/Qdrant rebuild steps documented and verifiable.
- Wider pilot decision materials in `/admin`, `/jobs`, `/audit`, DevLog.

## Post-MVP Ideas

- MAP search (geographic case map + filters; offline tiles) — discussed but **deferred**; not in mock. See [18 § Post-MVP](./18-webui-mock-inventory-and-flows.md#post-mvp-deferred).
- Native image similarity search.
- Advanced ranking using reliability, accuracy, and rank.
- Metadata-weighted ranking beyond optional ReRank.
- Case relation graph.
- Retention expiration workflows.
- Redaction workflow for external sharing.
- Analytics for search and AI usage.
