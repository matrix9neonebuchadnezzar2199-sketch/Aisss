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

### Startup race: `jobs` table vs worker

On a **cold start** (`make up` after `make down` or first boot), the **worker** and **api** containers start in parallel. Only **api** runs SQL migrations (`API_MIGRATE_ON_START=true`). The worker waits for PostgreSQL health but **not** for migrations to finish.

Until api has applied migrations, the worker poll loop may log errors such as `relation "jobs" does not exist`. This is **transient**, not data corruption. The worker recovers on the next poll once the `jobs` table exists.

| Symptom | Meaning | Operator action |
|---|---|---|
| Worker logs: `loop error` / missing `jobs` table | Migrations still running on api | Wait 10–30 s; confirm `curl http://localhost:8000/api/health` is 200 |
| `/jobs` empty or API 500 immediately after `make up` | Same race window | Refresh after api health is OK |
| Errors persist after api is healthy | Not the startup race | Check api logs for migration failure; run `make migrate` |

Recommended cold-start order for operators:

1. `make up`
2. Wait for `GET /api/health` → 200
3. Then open `/jobs` or upload attachments that enqueue extraction jobs

After code changes, rebuild application images before restart: **`make deploy`** (build + up + verify) or `make build && make up` then **`make verify-deploy`**.

**`git push` alone does not update running containers.** Host-side `npm run build` does not update the web container either.

See [Deploy verification](#deploy-verification-running-containers) and [Audit CSV Export](#audit-csv-export-excel--utf-8-bom).

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

## Deploy verification (running containers)

Use this after **any** change to `apps/web`, `apps/api`, or `apps/workers` before telling operators or AI sessions the fix is live.

### Why

Docker serves **built images**, not the git working tree. Stale images caused:

- Audit CSV mojibake after BOM fix (api image not rebuilt)
- M19 WebUI unchanged (web image still ~5.7 KB CSS vs ~30 KB after mock parity)

### Procedure

```powershell
cd F:\Cursor\Aisss
make deploy
```

Or stepwise:

```powershell
make build
docker compose -f aisss/docker-compose.yaml up -d web api worker
make verify-deploy
```

Linux/macOS verify script: `bash scripts/verify-docker-deploy.sh`

### What verify checks

| Check | Pass | Stale image action |
|---|---|---|
| Web CSS size in `aisss-web-1` | ≥ 20 KB total | `build web && up -d web` |
| Web CSS contains `gh-header` | yes | same |
| Audit CSV BOM (api, warn) | bytes `EF BB BF` | `build api && up -d api` |

### Manual web check

```powershell
docker exec aisss-web-1 sh -c "ls -la /usr/share/nginx/html/assets/*.css"
# Expect ~30KB index-*.css after M19+, not ~5KB
```

Open **`http://localhost:${AISSS_WEB_PORT:-3000}/search`** (not `/mockups/webui.html`). Hard refresh: Ctrl+Shift+R.

## Audit CSV Export (Excel / UTF-8 BOM)

After API code changes to CSV export, **rebuild and restart the `api` container**. A git push alone does not update running containers.

### Verify the live API returns UTF-8 BOM

Linux / macOS:

```bash
curl -s -H "X-AISSS-User-Id: 00000000-0000-4000-8000-000000000001" \
  "http://127.0.0.1:8000/api/audit-logs?export=csv" | head -c 16 | xxd
```

Windows (PowerShell — write raw bytes to a file; do not pipe through a string):

```powershell
curl.exe -s -H "X-AISSS-User-Id: 00000000-0000-4000-8000-000000000001" `
  "http://127.0.0.1:8000/api/audit-logs?export=csv" -o audit-test.csv
Format-Hex -Path audit-test.csv -Count 16
```

Expected first three bytes: **`EF BB BF`** (UTF-8 BOM), then `63 72 65 61 74 65 64 5f 61 74` (`created_at`).

| Observation | Likely cause | Action |
|---|---|---|
| No `EF BB BF` | Old API image still running | `make build && make up` or `docker compose -f aisss/docker-compose.yaml build api && docker compose -f aisss/docker-compose.yaml up -d api` |
| `EF BB BF` present but Excel still garbled | Old downloaded file or Excel locale | Delete prior `audit-logs.csv`, re-download, check file timestamp; or import via Excel **Data → From Text** with encoding **65001 UTF-8** |
| `EF BB BF` present; Notepad/VS Code shows correct Japanese | Data is fine; Excel misread an old file | Re-download after API verification |

Symptom when Excel opens UTF-8 without BOM as Shift_JIS: `user_name` column shows mojibake and **commas inside garbled text break column alignment** (action values appear merged into the name column). This is encoding mis-detection, not a CSV quoting bug.

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
