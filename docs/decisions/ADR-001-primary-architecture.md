# ADR-001: Use Aisss as the Primary Case System

## Status

Accepted

## Date

2026-06-09

## Context

Aisss must manage structured case records, many metadata fields, attachments, viewing ranges, handling conditions, and AI/RAG search. Dify and Ollama are important for AI workflow and generation, but Dify alone should not own the authoritative case metadata or permission model.

The system must support:

- Approximately 1,000 users.
- Case-level registration and attachment management.
- Editable master lists.
- Excel import.
- Office/PDF/image/audio text extraction.
- Strict viewing range and handling-condition control.
- AI search without leaking restricted content.

## Decision

Use Aisss as the primary case management system.

PostgreSQL stores case metadata, users, groups, viewing ranges, handling conditions, extracted text state, RAG synchronization state, and audit logs. Object storage stores original files. Dify and Ollama are used for workflow and generation after Aisss has applied permission-aware retrieval.

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

### File Server Plus Dify

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

### Aisss Primary System with Dify as AI Layer

Pros:

- Clear source of truth.
- Strong access control and audit model.
- Supports structured case fields and attachments.
- RAG index can be rebuilt from authoritative data.
- Dify can still provide workflow and AI UI capabilities.

Cons:

- Requires custom backend, WebUI, and middleware.
- More initial engineering work than a Dify-only prototype.

Accepted because it best matches the requirements and reduces permission leakage risk.

## Consequences

- Implementers must build Aisss WebUI and backend before relying on production AI search.
- Dify direct documents require governance through Aisss shadow metadata when used in sensitive workflows.
- Vector indexes and Dify knowledge state are treated as rebuildable secondary systems.
- Permission and audit logic stays centralized in Aisss.
