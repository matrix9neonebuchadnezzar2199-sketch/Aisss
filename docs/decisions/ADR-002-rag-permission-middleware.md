# ADR-002: Enforce RAG Permissions in Search Middleware

## Status

Accepted (amended 2026-06-09 — consumer is AISSS API/WebUI per ADR-004)

## Date

2026-06-09

## Context

AISSS must allow AI search over cases and extracted attachment text while respecting viewing ranges and handling conditions. Some cases may be visible to all users, while others may be limited to departments,担当者, or specific groups. Conditions such as 照会禁止 and 複製禁止 affect whether content can be retrieved, quoted, or exported.

If the LLM layer retrieves directly from an unrestricted vector index, restricted documents could influence answers for unauthorized users.

## Decision

Use a permissioned search middleware inside AISSS API, between the AI chat layer and the vector database.

Authenticated AISSS sessions (WebUI or trusted API) invoke search through the middleware. The middleware loads the user's groups and policies from PostgreSQL, filters search by allowed scope, rechecks candidate chunks against current case permissions, applies handling-condition rules, and returns only safe context to the chat completion step.

`/api/ai/chat` calls this logic internally. `POST /api/rag/search` remains available for the same contract with `channel` values such as `webui_chat`, `api`, and `export`.

## Alternatives Considered

### Knowledge Base Split by Viewing Range

Pros:

- Easier MVP.
- Works when permission groups are coarse and stable.

Cons:

- Difficult for case-level and person-level restrictions.
- Collection count can grow quickly.
- Permission changes require moving documents between collections.
- Harder to guarantee that overlapping conditions are enforced consistently.

Rejected as the primary design because AISSS needs precise case-level permissions.

### Native Retrieval with Prompt Instructions Only

Pros:

- Fastest prototype.
- Minimal custom middleware.

Cons:

- Prompt instructions are not a reliable access-control boundary.
- Unauthorized context may already be present before generation.
- Citations and hidden document existence can leak.

Rejected because access control must happen before generation.

### Permissioned Search Middleware

Pros:

- Keeps AISSS as the permission authority.
- Supports user/group/case/channel-specific rules.
- Can enforce denial before Ollama receives context.
- Allows final PostgreSQL recheck after vector candidate retrieval.
- Supports audit logging of retrieved case IDs.

Cons:

- Requires custom API and careful testing.
- AI chat must use the middleware instead of unrestricted retrieval.
- Vector metadata must be kept synchronized.

Accepted because it provides the strongest permission boundary for the stated requirements.

## Consequences

- `/api/ai/chat` must not call the vector database without passing through the middleware.
- Sensitive documents must not be exposed through unrestricted vector queries.
- Permission tests become a required part of the test suite.
- The vector database should support metadata filtering by case ID, viewing range, source type, and policy fields.
- Permission changes must trigger metadata resync or chunk recreation.
- Dify external-tool integration is no longer required (removed per ADR-004).

## Related

- [ADR-004: Native Ollama AI](./ADR-004-native-ollama-ai.md)
