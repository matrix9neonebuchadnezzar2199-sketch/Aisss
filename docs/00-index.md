# AISSS Documentation Index

**AISSS** — *Analytical Information Secure Sharing System*（分析的情報セキュア共有システム）

## Purpose

AISSS is a case management and permissioned RAG platform for storing information materials, attachments, extracted text, and AI-searchable knowledge. These documents are the baseline for future implementation decisions.

The central design rule is simple: the case management database is the source of truth. Ollama (on the host) and vector search are secondary systems that must respect the permissions and handling conditions stored in AISSS.

## Recommended Reading Order

1. [Requirements](./01-requirements.md)
2. [Overall Design](./02-overall-design.md)
3. [Sequence Diagrams](./03-sequence-diagrams.md)
4. [Data Flow](./04-data-flow.md)
5. [Data Model](./05-data-model.md)
6. [RAG Permission Design](./06-rag-permission-design.md)
7. [Ingestion Design](./07-ingestion-design.md)
8. [WebUI Design](./08-webui-design.md)
9. [WebUI Mock Inventory and Flows](./18-webui-mock-inventory-and-flows.md) — mock hub; read after 08 when exploring the HTML prototype
10. [API Design](./09-api-design.md)
11. [File Structure](./10-file-structure.md)
12. [Milestones](./11-milestones.md)
13. [Foundation Materials](./12-foundation-materials.md)
14. [Deployment: Docker Topology](./13-deployment-docker.md)
15. [Ollama Integration Guide](./15-ollama-integration.md)
16. [RAG Admin Guide](./16-rag-admin-guide.md)
17. [Viewing Range Permission Flow](./17-viewing-range-permission-flow.md)
18. [Operational Runbook](./19-operational-runbook.md)
19. [Versioning](./21-versioning.md) — SemVer + git SHA in UI and `/api/health`
20. [WebUI Mockup](../mockups/webui.html)（HTML）
21. [Case Detail Mockup](../mockups/case-detail.html)（HTML）
22. [Development Diary](./dev-diary.md)

## Flow-Oriented Reading

| Question | Suggested path |
|---|---|
| What does each mock screen do? | [18](./18-webui-mock-inventory-and-flows.md) → [webui.html](../mockups/webui.html) → [08](./08-webui-design.md) |
| Viewing range operations | [17](./17-viewing-range-permission-flow.md) → [18 § Flow A/B/C](./18-webui-mock-inventory-and-flows.md#operator-flows) → [06](./06-rag-permission-design.md) |
| RAG administration | [16](./16-rag-admin-guide.md) → [18](./18-webui-mock-inventory-and-flows.md) → [07](./07-ingestion-design.md) → [09](./09-api-design.md) |
| Implementation start | [11](./11-milestones.md) → [18 completeness matrix](./18-webui-mock-inventory-and-flows.md#screen-completeness-matrix) → [10](./10-file-structure.md) → [09](./09-api-design.md) |
| Case search → detail → edit | [18 § Flow B](./18-webui-mock-inventory-and-flows.md#flow-b-case-lifecycle-register--search--detail--edit--rag) → [03](./03-sequence-diagrams.md) → [case-detail.html](../mockups/case-detail.html) |
| UI layout (filters, body fields) | [18 § Layout Conventions](./18-webui-mock-inventory-and-flows.md#mock-layout-conventions) → [08](./08-webui-design.md) |
| パイロット運用 | [19](./19-operational-runbook.md) → [M28 dry-run](./m28-pilot-dry-run.md) → [11 § M28](./11-milestones.md#milestone-28-pilot-dry-run--go-no-go-closure) → [13](./13-deployment-docker.md) |

## Naming Convention

| Context | Name |
|---|---|
| Product / UI / documentation | **AISSS** |
| Full name (English) | Analytical Information Secure Sharing System |
| Full name (Japanese) | 分析的情報セキュア共有システム |
| Docker network / Compose project / API alias | `aisss-*` (lowercase technical IDs) |

## Architecture Decisions

- [ADR-001: Primary Architecture](./decisions/ADR-001-primary-architecture.md)
- [ADR-002: RAG Permission Middleware](./decisions/ADR-002-rag-permission-middleware.md)
- [ADR-003: Two Docker Stacks](./decisions/ADR-003-docker-two-stacks.md) (superseded)
- [ADR-004: Native Ollama AI](./decisions/ADR-004-native-ollama-ai.md)
- [ADR-005: Optional ReRank](./decisions/ADR-005-rerank-optional.md)

## Key Implementation Rules

- Do not let the LLM answer from documents that the requesting user cannot view in AISSS.
- Do not store original Office, PDF, image, or audio files directly in PostgreSQL.
- Keep original files in object storage and store only metadata, extracted text, and storage keys in the database.
- Use asynchronous jobs for OCR, ASR, Office parsing, PDF parsing, embedding, and RAG synchronization.
- Store structured body sections separately, but render them as one joined body in the WebUI.
- Treat handling conditions such as print prohibition, copy prohibition, inquiry prohibition, and channel-specific disclosure prohibition as enforceable rules, not as display labels.
- Ollama runs on the host; AISSS API proxies inference and exposes health in the WebUI.

## GitHub

Repository: <https://github.com/matrix9neonebuchadnezzar2199-sketch/Aisss>
