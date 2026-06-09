# Development Diary

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
