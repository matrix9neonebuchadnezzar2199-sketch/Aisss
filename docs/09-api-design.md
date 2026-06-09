# API Design

## Purpose

The API boundary keeps record management, permission enforcement, ingestion jobs, Ollama integration, and AI chat explicit. This document is a starting contract for implementation, not a final OpenAPI specification.

## API Groups

- Authentication and current user.
- Cases.
- Attachments.
- Excel import.
- Master management.
- Permission management.
- Extraction and RAG jobs.
- Permissioned search middleware.
- RAG administration.
- Ollama proxy and model roles.
- AI chat.
- Audit logs.

## Authentication Assumptions

The API should receive an authenticated user identity from the chosen SSO or identity provider. Until the identity provider is finalized, design endpoints around:

- `user_id`
- `display_name`
- `department_id`
- `groups`
- `roles`

The backend must not trust client-provided groups or roles without verification.

## Case APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/cases` | Search cases by metadata and text filters. |
| `POST` | `/api/cases` | Create case. |
| `GET` | `/api/cases/{case_id}` | Get case detail if authorized. |
| `PATCH` | `/api/cases/{case_id}` | Update case. |
| `DELETE` | `/api/cases/{case_id}` | Soft delete case and enqueue RAG cleanup. |
| `POST` | `/api/cases/{case_id}/reindex` | Operator-triggered reindex. |

Create and update requests should validate master values by ID. If label-based import is needed, resolve labels at the import layer before calling the case service.

## Attachment APIs

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/cases/{case_id}/attachments` | Upload attachment and enqueue extraction. |
| `GET` | `/api/cases/{case_id}/attachments` | List attachments. |
| `GET` | `/api/attachments/{attachment_id}/download` | Stream file after permission check. |
| `GET` | `/api/attachments/{attachment_id}/extracted-text` | Show extracted text if authorized. |
| `POST` | `/api/attachments/{attachment_id}/retry-extraction` | Retry failed extraction. |
| `DELETE` | `/api/attachments/{attachment_id}` | Delete attachment and cleanup derived chunks. |

Do not expose object storage signed URLs unless the URL is short-lived and generated after an application permission check.

## Excel Import APIs

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/imports/excel/preview` | Parse and validate workbook without committing. |
| `POST` | `/api/imports/excel/{preview_id}/confirm` | Commit valid rows. |
| `GET` | `/api/imports/{import_id}` | Get import result and row status. |

Preview records should expire. Confirm must verify the operator still has permission.

## Master APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/masters/{master_name}` | List active values. |
| `POST` | `/api/masters/{master_name}` | Add value. |
| `PATCH` | `/api/masters/{master_name}/{id}` | Update value. |
| `POST` | `/api/masters/{master_name}/{id}/deactivate` | Disable value. |

Master changes must be audited. Values referenced by cases should be deactivated, not deleted.

## Permission APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/users` | Operator user search. |
| `GET` | `/api/groups` | List groups. |
| `POST` | `/api/groups` | Create group. |
| `PATCH` | `/api/groups/{group_id}` | Update group. |
| `PUT` | `/api/groups/{group_id}/members` | Replace or update members. |
| `GET` | `/api/viewing-ranges` | List viewing ranges. |
| `POST` | `/api/viewing-ranges` | Create viewing range. |
| `PUT` | `/api/viewing-ranges/{id}/groups` | Map viewing range to groups. |

Changing group membership or viewing range mapping must invalidate permission caches.

## Job APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/jobs` | List extraction and RAG jobs. |
| `GET` | `/api/jobs/{job_id}` | Job detail. |
| `POST` | `/api/jobs/{job_id}/retry` | Retry failed job. |

## Permissioned Search Middleware API

Authenticated AISSS sessions call this API. `/api/ai/chat` also invokes the same logic internally. Callers must not query the unrestricted vector database directly.

`POST /api/rag/search`

Request:

```json
{
  "query": "string",
  "channel": "webui_chat",
  "top_k": 8,
  "filters": {
    "date_from": "2026-01-01",
    "date_to": "2026-12-31",
    "category_ids": []
  }
}
```

`user_id` is taken from the authenticated session, not from the request body.

Response:

```json
{
  "contexts": [
    {
      "chunk_id": "uuid",
      "case_id": "uuid",
      "display_id": "CASE-2026-00001",
      "title": "string",
      "text": "safe context text",
      "source_type": "case_body",
      "citation": "CASE-2026-00001 / title",
      "policies": {
        "quote_policy": "allow",
        "export_policy": "deny_print"
      }
    }
  ],
  "effective_policies": {
    "quote_policy": "summarize_only",
    "export_policy": "deny_print"
  }
}
```

Rules:

- The middleware loads actual user permissions server-side.
- Search results are rechecked against PostgreSQL before being returned.
- Denied documents are omitted without explanation to normal users.
- Optional ReRank runs when configured (ADR-005).

## RAG Administration APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/rag/status` | Index statistics and queue depth. |
| `GET` | `/api/rag/tree` | Genre / group / file tree for RAGの体系管理. |
| `GET` | `/api/rag/files` | Filtered file list with pipeline, RAG toggle, and viewing range metadata. |
| `PATCH` | `/api/rag/files/{id}/enable` | Set RAG 有効化 (㋹). |
| `POST` | `/api/rag/standalone-files` | Standalone file registration. |
| `PATCH` | `/api/rag/standalone-files/{id}/viewing-ranges` | Update standalone file viewing range from RAG admin. |
| `GET` | `/api/rag/cases/{case_id}/sync-state` | Per-case pipeline state. |

### `GET /api/rag/files` response (per item)

Each row includes:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Attachment or standalone file ID. |
| `source_kind` | string | `case_attachment` or `standalone`. |
| `case_id` | UUID, nullable | Parent case for attachments; used for “open case” navigation. |
| `viewing_range_ids` | UUID[] | Effective viewing range IDs. |
| `viewing_range_labels` | string[] | Display labels (e.g. `分析担当者のみ`). |
| `editable_viewing_range` | boolean | `true` only when `source_kind = standalone`. |
| `pipeline_status` | string | Extraction / embedding state. |
| `rag_enabled` | boolean | ㋹ state. |

Case attachments inherit `viewing_range_ids` from `case_viewing_ranges`. They are never editable via this API.

### `PATCH /api/rag/standalone-files/{id}/viewing-ranges`

Request:

```json
{
  "viewing_range_ids": ["uuid-of-range-b"]
}
```

Response: updated file row. Triggers audit log and RAG metadata resync job.

Attempts to PATCH viewing range on a `case_attachment` ID must return **409 Conflict**:

```json
{
  "error": {
    "code": "change_on_case_form",
    "message": "Viewing range for case attachments must be changed on the case form."
  }
}
```

## Ollama APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/ollama/health` | Connection status and latency. |
| `GET` | `/api/ollama/models` | Model list with AISSS role assignments. |
| `GET` | `/api/ollama/models/{name}` | Model detail (admin). |
| `PUT` | `/api/admin/ollama/model-roles` | Default models, enabled chat models, ReRank settings. |

See [Ollama Integration Guide](./15-ollama-integration.md).

## AI Chat APIs

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/ai/chat` | Permissioned RAG + Ollama completion. |
| `POST` | `/api/ai/chat/stream` | Same flow with SSE streaming. |

Request:

```json
{
  "message": "string",
  "model": "llama3.2:latest",
  "conversation_id": "optional-uuid",
  "filters": {}
}
```

## Audit APIs

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/audit-logs` | Operator audit search. |
| `GET` | `/api/audit-logs/{id}` | Audit detail. |

Audit APIs require dedicated authority separate from normal case viewing.

## Error Shape

Recommended error response:

```json
{
  "error": {
    "code": "permission_denied",
    "message": "You do not have permission to access this resource.",
    "request_id": "string"
  }
}
```

Error messages must not reveal restricted case titles or metadata.
