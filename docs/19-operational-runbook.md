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

## Known Limitations

- OCR and ASR engines are still stubs.
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
