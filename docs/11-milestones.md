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

## Post-MVP Ideas

- MAP search (geographic case map + filters; offline tiles) — discussed but **deferred**; not in mock. See [18 § Post-MVP](./18-webui-mock-inventory-and-flows.md#post-mvp-deferred).
- Native image similarity search.
- Advanced ranking using reliability, accuracy, and rank.
- Metadata-weighted ranking beyond optional ReRank.
- Case relation graph.
- Retention expiration workflows.
- Redaction workflow for external sharing.
- Analytics for search and AI usage.
