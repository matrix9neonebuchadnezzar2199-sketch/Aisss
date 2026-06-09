# ADR-001: Use AISSS as the Primary Case System

## Status

Accepted (amended 2026-06-09 — native Ollama AI per ADR-004)

## Date

2026-06-09

## Context

AISSS must manage structured case records, many metadata fields, attachments, viewing ranges, handling conditions, and AI/RAG search. Ollama on the host provides embeddings and chat generation. AISSS must own the authoritative case metadata, permission model, RAG pipeline, and AI chat surface.

The system must support:

- Case-level registration and attachment management.
- Editable master lists.
- Excel import.
- Office/PDF/image/audio text extraction.
- Strict viewing range and handling-condition control.
- AI search without leaking restricted content.

## Decision

Use AISSS as the primary case management system.

PostgreSQL stores case metadata, users, groups, viewing ranges, handling conditions, extracted text state, RAG synchronization state, model role configuration, and audit logs. Object storage stores original files. Vector indexes are rebuildable secondary stores.

AISSS API and WebUI provide permissioned RAG search, AI chat, RAG administration, and model management. Ollama on the host is called only from AISSS API and workers after permission-aware retrieval (see ADR-002, ADR-004).

## Alternatives Considered

### Dify as the Primary System

Pros:

- Faster initial prototype.
- Native document upload and chat experience.

Cons:

- Not a natural fit for the full case data model.
- Permission logic would be split or weakened.
- Harder to audit operational case changes.
- Risk that direct knowledge-base retrieval bypasses case access rules.

Rejected because the primary requirement is controlled case management, not only AI chat.

### File Server Plus External AI Tool

Pros:

- Simple to start.
- Minimal custom application code.

Cons:

- Weak structured metadata.
- Weak master management.
- Difficult Excel import validation.
- Poor auditability.
- Case-level permission and handling conditions would be fragile.

Rejected because it does not meet the record management requirement.

### AISSS Primary with Dify as AI Layer (superseded)

Previously accepted; superseded by ADR-004. Dify added a second stack and split UX without improving the permission model.

### AISSS Primary with Native Ollama Integration

Pros:

- Clear source of truth.
- Strong access control and audit model.
- Supports structured case fields and attachments.
- RAG index can be rebuilt from authoritative data.
- Unified WebUI for cases, RAG admin, model admin, and AI search.

Cons:

- Requires custom backend, WebUI, chat API, and middleware.
- More initial engineering work than an external AI-only prototype.

Accepted because it best matches the requirements and reduces permission leakage risk.

## Consequences

- Implementers must build AISSS WebUI, backend, `/api/ai/chat`, and Ollama integration before production AI search.
- Vector indexes are treated as rebuildable secondary systems.
- Permission and audit logic stays centralized in AISSS.
- Host Ollama must be available for embedding and chat; health is surfaced in WebUI.

## Related

- [ADR-004: Native Ollama AI](./ADR-004-native-ollama-ai.md)
