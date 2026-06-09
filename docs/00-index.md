# AISSS Documentation Index

**AISSS** — *Analytical Information Secure Sharing System*（分析的情報セキュア共有システム）

## Purpose

AISSS is a case management and permissioned RAG platform for storing information materials, attachments, extracted text, and AI-searchable knowledge. These documents are the baseline for future implementation decisions.

The central design rule is simple: the case management database is the source of truth. Dify, Ollama, and vector search are secondary systems that must respect the permissions and handling conditions stored in AISSS.

## Recommended Reading Order

1. [Requirements](./01-requirements.md)
2. [Overall Design](./02-overall-design.md)
3. [Sequence Diagrams](./03-sequence-diagrams.md)
4. [Data Flow](./04-data-flow.md)
5. [Data Model](./05-data-model.md)
6. [RAG Permission Design](./06-rag-permission-design.md)
7. [Ingestion Design](./07-ingestion-design.md)
8. [WebUI Design](./08-webui-design.md)
9. [API Design](./09-api-design.md)
10. [File Structure](./10-file-structure.md)
11. [Milestones](./11-milestones.md)
12. [Foundation Materials](./12-foundation-materials.md)
13. [Deployment: Docker Topology](./13-deployment-docker.md)
14. [Dify Integration Guide](./14-dify-integration-guide.md)
15. [WebUI Mockup](../mockups/webui.html)（HTML）
16. [Development Diary](./dev-diary.md)

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
- [ADR-003: Two Docker Stacks](./decisions/ADR-003-docker-two-stacks.md)

## Key Implementation Rules

- Do not let Dify answer from documents that the requesting user cannot view in AISSS.
- Do not store original Office, PDF, image, or audio files directly in PostgreSQL.
- Keep original files in object storage and store only metadata, extracted text, and storage keys in the database.
- Use asynchronous jobs for OCR, ASR, Office parsing, PDF parsing, embedding, and RAG synchronization.
- Store structured body sections separately, but render them as one joined body in the WebUI.
- Treat handling conditions such as print prohibition, copy prohibition, inquiry prohibition, and channel-specific disclosure prohibition as enforceable rules, not as display labels.

## GitHub

Repository: <https://github.com/matrix9neonebuchadnezzar2199-sketch/Aisss>
