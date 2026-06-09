# ADR-005: Optional ReRank for Permissioned RAG

## Status

Accepted

## Date

2026-06-09

## Context

Vector search returns candidates by embedding similarity. Metadata filtering and permission recheck reduce unauthorized leakage but do not always order the most relevant authorized chunks first.

ReRank models score query–passage pairs and can improve answer quality when `top_k` is large. They add latency, host GPU/CPU load, and require another Ollama model on the host.

## Decision

ReRank is **optional and off by default**.

When disabled (default):

1. Embed the user query via Ollama.
2. Vector search with metadata filters (`top_k` as configured, e.g. 8).
3. Permission recheck in PostgreSQL.
4. Pass results directly to chat completion.

When enabled (admin configures `rerank_model` in model roles):

1. Vector search with a larger candidate pool (e.g. `top_k=20`).
2. Permission recheck.
3. ReRank candidates with the configured Ollama rerank model.
4. Take final `top_k` (e.g. 8) for chat completion.

Administrators enable ReRank in model management. If `rerank_model` is empty, the pipeline skips reranking.

## Alternatives Considered

### No ReRank Ever

Pros:

- Simplest pipeline and lowest latency.

Cons:

- May miss better chunk ordering for long corpora.

Acceptable as default behavior; not as a permanent ban.

### Required ReRank in MVP

Pros:

- Best retrieval quality from day one.

Cons:

- Extra model pull and ops burden.
- Slower queries on CPU-only hosts.

Rejected for initial release.

### Optional ReRank (Default Off)

Pros:

- Simple default path for MVP.
- Operators can enable when quality issues appear.
- Fits host Ollama model management.

Cons:

- Two code paths to test.
- Admins must choose a suitable rerank model.

Accepted.

## Consequences

- Model roles include `rerank_model` (nullable).
- RAG admin UI shows ReRank toggle state (read-only for operators; editable for admins).
- API and worker config document recommended rerank models (environment-dependent).
- Limit concurrent rerank jobs to 1 in initial implementation to reduce host contention.
- Permission tests must cover both rerank on and off paths.

## Related

- [ADR-004: Native Ollama AI](./ADR-004-native-ollama-ai.md)
- [Ollama Integration Guide](../15-ollama-integration.md)
