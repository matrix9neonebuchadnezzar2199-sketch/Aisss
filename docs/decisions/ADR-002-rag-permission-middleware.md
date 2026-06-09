# ADR-002: Enforce RAG Permissions in Search Middleware

## Status

Accepted

## Date

2026-06-09

## Context

Aisss must allow AI search over cases and extracted attachment text while respecting viewing ranges and handling conditions. Some cases may be visible to all users, while others may be limited to departments,担当者, or specific groups. Conditions such as 照会禁止 and 複製禁止 affect whether content can be retrieved, quoted, or exported.

If Dify retrieves directly from a shared knowledge base, restricted documents could influence answers for unauthorized users.

## Decision

Use a permissioned search middleware between Dify and the vector database.

Dify sends the user question and trusted user identity to the middleware. The middleware loads the user's groups and policies from PostgreSQL, filters search by allowed scope, rechecks candidate chunks against current case permissions, applies handling-condition rules, and returns only safe context to Dify.

## Alternatives Considered

### Dify Knowledge Base Split by Viewing Range

Pros:

- Easier MVP.
- Uses Dify features more directly.
- Works when permission groups are coarse and stable.

Cons:

- Difficult for case-level and person-level restrictions.
- Knowledge base count can grow quickly.
- Permission changes require moving documents between collections.
- Harder to guarantee that overlapping conditions are enforced consistently.

Rejected as the primary design because Aisss needs precise case-level permissions.

### Dify Native Retrieval with Prompt Instructions

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

- Keeps Aisss as the permission authority.
- Supports user/group/case/channel-specific rules.
- Can enforce denial before Dify and Ollama receive context.
- Allows final PostgreSQL recheck after vector candidate retrieval.
- Supports audit logging of retrieved case IDs.

Cons:

- Requires custom API and careful testing.
- Dify workflows must call the middleware instead of unrestricted retrieval.
- Vector metadata must be kept synchronized.

Accepted because it provides the strongest permission boundary for the stated requirements.

## Consequences

- The Dify workflow must integrate with the middleware as an external tool or API step.
- Sensitive documents must not be exposed through unrestricted Dify knowledge retrieval.
- Permission tests become a required part of the test suite.
- The vector database should support metadata filtering by case ID, viewing range, source type, and policy fields.
- Permission changes must trigger metadata resync or chunk recreation.
