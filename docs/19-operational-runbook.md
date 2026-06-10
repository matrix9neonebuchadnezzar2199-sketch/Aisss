# Operational Runbook

## Purpose

This runbook covers the M7 pilot operating loop for AISSS: startup, health checks, job triage, backup/restore evidence, feedback intake, and known limitations.

## Daily Startup Check

1. Start host Ollama and confirm required models are available:
   ```bash
   ollama list
   ```
2. Start the AISSS stack:
   ```bash
   make up
   make ps
   ```
3. Verify service health:
   ```bash
   curl http://localhost:8000/api/health
   curl http://localhost:8000/api/ollama/health
   ```
4. Open WebUI:
   - `/admin` for operational dashboard.
   - `/jobs` for failed or dead-letter jobs.
   - `/audit` for security-sensitive activity.

## Job Triage

Use **ジョブ状態** (`/jobs`) for extraction, embedding, and RAG metadata jobs.

| Status | Operator action |
|---|---|
| `pending` | Wait unless queue is stalled. |
| `running` | Check worker logs if long-running. |
| `failed` | Review error, then retry once if the cause is transient. |
| `dead_letter` | Investigate input/config before retrying. |

Retry writes an audit record (`job.retry`). Moving a job to DLQ writes `job.dead_letter`.

## Backup and Restore Evidence

Minimum pilot backup scope:

- PostgreSQL: case metadata, permissions, audit, jobs, RAG metadata.
- MinIO: original attachments and standalone files.
- Qdrant: rebuildable from PostgreSQL + MinIO, optional backup.
- Ollama models: host-managed, record model names and versions.

Record every restore check through:

```http
POST /api/admin/backup-checks
```

Fields:

- `scope`: `postgres`, `minio`, `qdrant`, or `full-stack`.
- `status`: `ok`, `partial`, or `failed`.
- `notes`: restore evidence and operator notes.

## Permission Regression Checks

Before and during pilot:

1. Use admin user to create or verify viewing ranges and groups.
2. Use a pilot/operator user outside a restricted range.
3. Confirm restricted cases do not appear in case detail or RAG answers.
4. Confirm `照会禁止` content is excluded from AI answers.
5. Confirm AI citations only link to authorized case display IDs.

## Pilot Feedback Loop

Use **本番パイロット** (`/pilot`) to collect feedback.

Statuses:

- `new`: submitted, not yet reviewed.
- `triaged`: accepted into work queue or backlog.
- `closed`: resolved, duplicate, or intentionally deferred.

Weekly triage output should split items into:

- M6/M7 fix before wider pilot.
- Post-MVP enhancement.
- Documentation/training update.

## Retrieval Evaluation Harness

Before loading representative pilot data, run the lightweight Japanese retrieval eval:

```bash
npm test -w @aisss/api -- src/rag-eval.test.ts
```

The eval set lives in `apps/api/eval/retrieval-eval-set.json`. It checks:

- in-range hits return expected `display_id` values
- out-of-range and `照会禁止` cases never leak into contexts or citations
- `excluded_counts` records the denial reason

Extend the JSON scenarios as pilot questions stabilize.

## Pilot Validation Checklist

Run these checks with representative pilot data before wider rollout:

| Area | Validation |
|---|---|
| Japanese retrieval quality | Ask 10-20 expected-answer questions and record missed or irrelevant citations. |
| Permissioned RAG | Confirm `照会禁止` cases never appear in context, citations, audit titles, or AI answers. |
| Output policy | Confirm `複製禁止` and `印刷禁止` are reflected in answer policy and Web UI affordances. |
| RAG enablement | Confirm extracted-but-not-RAG-enabled files are visible in RAG management. |
| Auto RAG reservation | Confirm attachment auto-enable only runs after extraction succeeds and viewing ranges exist. |
| Auditability | Confirm AI query audit records include `retrieved_case_ids` and `excluded_counts` without denied titles. |
| Operations | Confirm failed extraction/embedding jobs are visible, retryable, and eventually DLQ when attempts are exhausted. |

## Post-MVP Cut Criteria

Create explicit Post-MVP tasks when pilot feedback shows one of these patterns:

- OCR/ASR: two or more real pilot files require image/audio extraction.
- Retrieval quality: repeated Japanese query misses are caused by embedding model quality rather than permissions.
- RAG operations: operators cannot reliably find pending, failed, or not-enabled knowledge candidates.
- Audit/compliance: reviewers need evidence not currently captured in `audit_logs.details_json`.
- UI safety: users misunderstand whether an attachment is searchable by AI.

## Pilot Dry Run Checklist

Run once with admin, operator, and pilot users before loading representative production data.

| Step | Actor | Route / action | Expected result | Automated check |
|---|---|---|---|---|
| 1 | Admin | `make up` + `/api/health` | API healthy | Manual |
| 2 | Admin | Register case with `全員` viewing range | Case saved, viewing range required | Manual |
| 3 | Operator | Upload PDF attachment, auto-enable OFF | Extraction completes, RAG OFF | Manual |
| 4 | Operator | Toggle `抽出後RAG自動ON`, re-upload or PATCH | Reservation stored | Manual |
| 5 | Operator | `/rag` |未ナレッジ化候補 highlighted | Manual |
| 6 | Operator | Enable RAG on extracted file | Embedding job enqueued | Manual |
| 7 | Pilot | `/ai` query on public case | Authorized citation only | Manual |
| 8 | Pilot | Query referencing `照会禁止` case | No context/citation leak | `npm test -w @aisss/api -- src/rag-eval.test.ts` |
| 9 | Pilot | `/cases` list | Sees `全員` only, not analyst-only cases | `route-integration.test.ts` in CI |
| 10 | Admin | `/audit` | AI query audit shows `excluded_counts` | Manual |
| 11 | Operator | `/jobs` failed job retry | Retry audit recorded | Manual |
| 12 | All | `npm test` + `npm run build` | Green before pilot week | CI |

Record dry-run outcomes in `90_DevLog/` with `status: ok|warn|err` per step. Blockers become M19 fix tasks.

## Known Limitations

- OCR and ASR engines are pilot stubs; image/audio require manual `.txt` transcripts (see `07-ingestion-design.md` M17 decision).
- Web AI chat uses non-streaming response while SSE API exists.
- RAG admin tree cascade is basic compared with the HTML mock.
- ReRank configuration is stored, but ReRank execution remains off.
- Search filters are not yet the full target list.
- Qdrant vectors are rebuildable and should not be treated as the source of truth.

## Rollback

If an operational change causes issues:

1. Stop new pilot activity.
2. Capture current `/admin`, `/jobs`, and `/audit` state.
3. Revert the last application commit if needed.
4. Restore PostgreSQL/MinIO only from a verified backup.
5. Rebuild vectors from extracted text if Qdrant is inconsistent.
