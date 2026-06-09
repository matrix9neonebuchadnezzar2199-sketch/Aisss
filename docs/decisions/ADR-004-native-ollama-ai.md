# ADR-004: Native Ollama AI in AISSS (Dify Removed)

## Status

Accepted

## Date

2026-06-09

## Context

AISSS already owns case metadata, attachment ingestion, extraction workers, embedding jobs, vector synchronization, and permissioned search middleware. Dify was initially included as an AI workflow and chat orchestration layer that called the search middleware and Ollama for generation.

Operational requirements now favor a single product:

- RAG pipeline monitoring and control from AISSS WebUI.
- Model management against a host Ollama instance.
- SaaS-style model selection in the AI chat screen.
- Ollama health visibility in the WebUI.
- No separate Dify stack to upgrade, secure, or back up.

ADR-002 remains valid: permission enforcement must happen before any text reaches the LLM.

## Decision

Remove Dify from the architecture. AISSS WebUI and API provide:

- **RAG admin** — monitor and control extraction, embedding, and vector sync.
- **Model admin** — list Ollama models and assign roles (chat, embedding, rerank).
- **AI search** — authenticated chat that calls permissioned search internally, then Ollama on the host.
- **Ollama proxy** — health and model APIs; WebUI never calls Ollama directly.

Ollama runs on the **host** (outside AISSS Docker Compose). Containers reach it via `OLLAMA_BASE_URL` (default `http://host.docker.internal:11434`).

The permissioned search middleware stays inside AISSS API. `POST /api/ai/chat` invokes it as an internal function with `channel: "webui_chat"` instead of an external Dify tool call.

## Alternatives Considered

### Keep Dify as AI Layer (ADR-001 original)

Pros:

- Faster initial chat prototype.
- Visual workflow editor for operators.

Cons:

- Two Docker stacks and integration contracts to maintain.
- Split UX between case management and AI chat.
- Dify direct knowledge upload conflicts with AISSS as source of truth.

Rejected in favor of a unified AISSS product surface.

### Embed Ollama in AISSS Compose

Pros:

- Single `docker compose up` includes inference.

Cons:

- GPU binding and model storage differ per host.
- Heavier compose file; harder to share GPU with other tools.

Rejected; host Ollama is the deployment default.

### AISSS Primary with Native Ollama Integration

Pros:

- Single permission and audit boundary.
- RAG admin and model admin in one WebUI.
- Simpler deployment (one AISSS stack + host Ollama).
- Middleware design from ADR-002 unchanged in spirit.

Cons:

- More custom code for chat, streaming, and model admin.
- Prompt and workflow changes require application deploys, not Dify GUI edits.

Accepted because it matches the product direction and keeps security centralized.

## Consequences

- Delete Dify integration guide, Dify compose override, and Dify-related environment variables.
- Supersede ADR-003 (two-stack deployment).
- Add `api/ollama`, `api/ai`, RAG admin APIs, and corresponding WebUI screens.
- Remove `dify_direct_shadow` ingestion path and Dify knowledge shadow-sync milestones.
- Implementers must build `/api/ai/chat` and streaming before production AI search.
- Host Ollama must be running for AI features; WebUI shows health state when unavailable.

## Related

- [ADR-002: RAG Permission Middleware](./ADR-002-rag-permission-middleware.md)
- [ADR-005: Optional ReRank](./ADR-005-rerank-optional.md)
- [Ollama Integration Guide](../15-ollama-integration.md)
