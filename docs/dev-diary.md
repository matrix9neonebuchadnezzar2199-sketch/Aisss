# Development Diary

## 2026-06-09: Milestone 3 Attachment and Extraction MVP

### Summary

Implemented attachment upload to MinIO, async extraction jobs, worker for PDF/text/DOCX parsing (OCR/ASR stubs), download and extracted-text APIs, and Web attachment panel with status polling and retry.

### New / Updated

- `infra/migrations/004_m3_extracted_texts.sql`
- `apps/api` — storage service, attachment routes, multipart upload
- `apps/workers` — job poller, pdf-parse, mammoth
- `apps/web` — `AttachmentPanel` on register (edit) and detail
- `aisss/.env.example`, `docs/11-milestones.md`

---

## 2026-06-09: Milestone 2 Case Management API and Web Wiring

### Summary

Extended PostgreSQL schema (masters, permissions joins, audit, jobs), implemented case CRUD/search with viewing-range permission checks, masters/permissions/audit/jobs/Ollama models APIs, and connected React pages for search, register, edit, and detail.

### New / Updated

- `infra/migrations/002_m2_schema.sql`, `003_dev_seed.sql`
- `apps/api/src/routes/*`, `services/cases.ts`, `plugins/auth.ts`
- `apps/web/src/pages/*`, `lib/api.ts`
- `docs/11-milestones.md`

---

## 2026-06-09: Milestone 1 Application Skeleton

### Summary

Added runnable M1 skeleton: Fastify API with health endpoints and SQL migrations, Vite+React WebUI shell with sidebar routes and API status, worker heartbeat stub, root npm workspaces, CI workflow, and Compose build contexts updated to monorepo root.

### New / Updated

- `apps/api`, `apps/web`, `apps/workers`, `infra/migrations/001_init.sql`
- `package.json`, `package-lock.json`, `.github/workflows/ci.yml`
- `aisss/docker-compose.yaml`, `Makefile`, `aisss/.env.example`, `README.md`, `docs/11-milestones.md`

---

## 2026-06-09: Mock UI Layout Sync to Design Docs

### Summary

Synced recent `webui.html` layout changes into requirements and WebUI design docs: case search 4-row filter, audit log 2-row filter, registration body vertical stack with tall 記事 field, and search filter collapse CSS fix (`:not(.collapsed)` for expanded `max-height`).

### New / Updated

- `docs/08-webui-design.md` — filter layouts, body stack, collapse implementation note, UX rules; sidebar placeholder wording fixed
- `docs/18-webui-mock-inventory-and-flows.md` — **Mock Layout Conventions** section; completeness matrix layout notes
- `docs/01-requirements.md` — Body Handling: edit UI vertical vs read UI joined
- `docs/11-milestones.md` — M2 mock coverage aligned (audit/jobs UI mocked; API still M6)
- `docs/00-index.md`, `docs/10-file-structure.md` — links to Layout Conventions / `form-body-stack`

### Prior session (same day)

- 監査ログ・ジョブ状態 mocks added to `webui.html`; stats cross-links to jobs; audit ↔ cases/AI/RAG

---

## 2026-06-09: WebUI Mock Inventory and Flow Alignment

### Summary

Analyzed static HTML mocks (`webui.html`, `case-detail.html`) and added a documentation hub so screens, operator flows, APIs, and milestones cross-reference consistently. MAP search remains deferred (Post-MVP).

### New / Updated

- `docs/18-webui-mock-inventory-and-flows.md` — screen matrix, Flows A/B/C, demo display IDs, backlog
- `docs/00-index.md` — flow-oriented reading paths, case-detail mock link
- `docs/03-sequence-diagrams.md` — search/detail/edit, permission bootstrap, standalone reg, RAG delete/guard
- `docs/04-data-flow.md` — WebUI screen map, freshness rules with triggering screens
- `docs/08-webui-design.md` — mock status per screen, UX rules (sort, sidebar collapse)
- `docs/11-milestones.md` — mock coverage notes per milestone; MAP deferred in Post-MVP
- Cross-links in `09`, `10`, `16`, `17`, `README.md`

---

## 2026-06-09: Dify Removed — Native Ollama AI

### Summary

Architecture pivot: Dify removed. AISSS now owns AI chat, RAG administration, model management, and Ollama proxy. Host Ollama for embeddings and completion. ReRank optional (default off). ADR-004 and ADR-005 added; ADR-003 superseded.

### New / Updated

- `docs/15-ollama-integration.md`, `docs/16-rag-admin-guide.md`
- `docs/decisions/ADR-004-native-ollama-ai.md`, `ADR-005-rerank-optional.md`
- Sidebar mockup: RAG 管理, モデル管理, AI 検索 with model selector
- Single-stack Docker; `dify/` removed

---

## 2026-06-09: Product Name and WebUI Mockup

### Summary

Formal product name set to **AISSS** (*Analytical Information Secure Sharing System* / 分析的情報セキュア共有システム). Updated README and documentation. Added GitHub-style HTML WebUI mockup at `mockups/webui.html`.

---

## 2026-06-09: Design Baseline Created

### Summary

Created the initial documentation baseline for AISSS. The design treats AISSS as a case management system with a permissioned RAG layer, using Dify and Ollama for AI workflow and generation.

### Decisions

- The case management database is the source of truth.
- Dify is not the source of truth for access control.
- RAG search must go through permissioned search middleware.
- Original files are stored in object storage, not PostgreSQL.
- Office, PDF, image, and audio inputs are processed asynchronously.
- Case body sections are stored separately and rendered as one joined body in the WebUI.
- Conditions such as 印刷禁止, 複製禁止, 照会禁止, and channel-specific disclosure prohibition are enforceable policy inputs.

### Created Documents

- `docs/00-index.md`
- `docs/01-requirements.md`
- `docs/02-overall-design.md`
- `docs/03-sequence-diagrams.md`
- `docs/04-data-flow.md`
- `docs/05-data-model.md`
- `docs/06-rag-permission-design.md`
- `docs/07-ingestion-design.md`
- `docs/08-webui-design.md`
- `docs/09-api-design.md`
- `docs/10-file-structure.md`
- `docs/11-milestones.md`
- `docs/12-foundation-materials.md`
- `docs/decisions/ADR-001-primary-architecture.md`
- `docs/decisions/ADR-002-rag-permission-middleware.md`

### Open Items

- Choose backend framework.
- Choose vector database.
- Choose OCR and ASR engines.
- Decide identity provider and SSO integration.
- Approve the handling condition matrix with the actual organization rules.
- Prepare initial master data and synthetic test cases.

### Next Step

Start Milestone 1 by creating the repository skeleton, local development stack, `.env.example`, and first database migration plan.
