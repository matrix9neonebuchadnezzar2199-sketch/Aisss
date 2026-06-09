# File Structure

## Recommended Repository Layout

This structure is a starting point for implementation. It keeps WebUI, backend API, workers, infrastructure, and documentation separated.

```text
AISSS/
  docs/
    00-index.md
    01-requirements.md
    02-overall-design.md
    03-sequence-diagrams.md
    04-data-flow.md
    05-data-model.md
    06-rag-permission-design.md
    07-ingestion-design.md
    08-webui-design.md
    09-api-design.md
    10-file-structure.md
    11-milestones.md
    12-foundation-materials.md
    13-deployment-docker.md
    15-ollama-integration.md
    16-rag-admin-guide.md
    17-viewing-range-permission-flow.md
    18-webui-mock-inventory-and-flows.md
    19-operational-runbook.md
    dev-diary.md
    decisions/
      ADR-001-primary-architecture.md
      ADR-002-rag-permission-middleware.md
      ADR-003-docker-two-stacks.md
      ADR-004-native-ollama-ai.md
      ADR-005-rerank-optional.md
  aisss/
    docker-compose.yaml
    .env.example
  mockups/
    webui.html
    case-detail.html
  Makefile
  apps/
    web/
      src/
        app/
        components/
        features/
        lib/
        routes/
        styles/
      tests/
    api/
      src/
        aisss/
          api/
          auth/
          cases/
          attachments/
          imports/
          masters/
          permissions/
          rag/
          ai/
          ollama/
          audit/
          jobs/
          db/
          settings/
      tests/
    workers/
      src/
        aisss_workers/
          extraction/
          embedding/
          rag_sync/
          shared/
      tests/
  packages/
    shared-contracts/
      src/
  infra/
    docker/
    compose/
    migrations/
    scripts/
  templates/
    excel/
  tools/
    maintenance/
  .env.example
  README.md
```

## Backend Module Responsibilities

| Module | Responsibility |
|---|---|
| `auth` | Trusted identity mapping, role loading, group membership. |
| `cases` | Case create, update, delete, search, body rendering. |
| `attachments` | Upload, metadata, download permission checks. |
| `imports` | Excel preview, validation, confirmed import. |
| `masters` | Editable master values. |
| `permissions` | Viewing ranges, condition policy evaluation, group mapping. |
| `rag` | Search middleware, chunk metadata, RAG admin status APIs. |
| `ai` | Chat completion orchestration, streaming, policy-aware prompts. |
| `ollama` | Health, model list proxy, model role configuration. |
| `audit` | Audit log write and operator search. |
| `jobs` | Job dispatch, retry, status, dead-letter handling. |
| `ops` | Admin dashboard, backup/restore checks, pilot feedback. |
| `db` | Database models, migrations, transactions. |
| `settings` | Environment and runtime configuration. |

## Worker Module Responsibilities

| Module | Responsibility |
|---|---|
| `extraction` | Office/PDF parsing, OCR, ASR, manual text normalization. |
| `embedding` | Chunking, Ollama embedding generation, vector upsert. |
| `rag_sync` | Metadata resync, vector cleanup, rebuild. |
| `shared` | Shared job payloads, logging, storage access. |

## Frontend Feature Areas

Static HTML mocks today: [18-webui-mock-inventory-and-flows.md](./18-webui-mock-inventory-and-flows.md).

| Feature | Mock view / file | Notes |
|---|---|---|
| `case-registration` | `view-register` | Form sections matching the data model; body fields in `form-body-stack` (vertical; 記事 tallest); edit via `?edit=`. See [18 § Layout Conventions](./18-webui-mock-inventory-and-flows.md#mock-layout-conventions). |
| `case-search` | `view-search` | 4-row collapsible filter panel (`search-filter-panel`); five filter controls in mock. |
| `case-detail` | `case-detail.html` | Joined body view, attachment panel; audit markers planned. |
| `excel-import` | `view-register` (button) | Preview, errors, confirm — mock has autofill only. |
| `ai-search` | `view-ai` | Native chat with model selector; mock is static demo. |
| `rag-admin` | `view-rag-admin` | Pipeline dashboard, tree, list; high mock coverage. |
| `standalone-file` | `view-standalone-file` | Opened from RAG 管理. |
| `model-management` | `view-models` | Ollama models, roles, ReRank toggle. |
| `ollama-status` | header / `view-ai` | Global health indicator component. |
| `master-management` | `view-masters` | Editable lists. |
| `permission-management` | `view-permissions` | Groups and viewing ranges. |
| `job-monitoring` | `view-jobs` | Extraction and RAG job list; links from search/RAG stats. |
| `audit-logs` | `view-audit` | Operator audit search UI; detail dialog. |
| `admin-dashboard` | M6 React page | Operational metrics and links into jobs, audit, RAG, and pilot feedback. |
| `pilot-feedback` | M7 React page | Limited pilot feedback intake and triage. |

## Configuration Files

Recommended environment variables:

- `DATABASE_URL`
- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_ACCESS_KEY`
- `OBJECT_STORAGE_SECRET_KEY`
- `REDIS_URL`
- `VECTOR_DB_URL`
- `OLLAMA_BASE_URL`
- `OLLAMA_HEALTH_INTERVAL_SEC`
- `AUTH_PROVIDER`

Never commit real `.env` files.

## Implementation Notes

- Keep API contracts in a shared package or generated client once the stack is chosen.
- Keep database migrations close to the backend or `infra/migrations`, but use one authoritative location.
- Keep Excel templates versioned under `templates/excel`.
- Keep operational scripts under `tools/maintenance` and make them idempotent.
