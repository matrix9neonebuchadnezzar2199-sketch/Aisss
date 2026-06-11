# M28 Pilot Dry Run / Go-No-Go

M28 gate before wider pilot. Complements [19-operational-runbook.md](./19-operational-runbook.md) and [20-webui-wiring-checklist.md](./20-webui-wiring-checklist.md#m28-pilot-dry-run--go-no-go).

## Prerequisites

| Item | Windows (PowerShell) | Unix |
|---|---|---|
| Stack up | `docker compose -f aisss/docker-compose.yaml up -d` | `make up` |
| Host Ollama | `ollama list` shows chat model | same |
| Dev users | admin `…000001`, operator `…000002`, pilot `…000003` | seed `003_dev_seed.sql`, `007_m6_m7_ops_pilot.sql` |

## Automated baseline (run first)

```powershell
cd F:\Cursor\Aisss
pwsh scripts/pilot-smoke.ps1 -RecordBackupCheck
```

Covers: `/api/health`, `/api/ollama/health`, `rag-eval.test.ts`, full API/worker tests, web build, Docker verify, admin dashboard, optional `POST /api/admin/backup-checks`.

## Manual dry-run steps (12)

Record each step as **ok | warn | err** in [m28-go-no-go-results.md](./m28-go-no-go-results.md) and `ObsidianVault/90_DevLog/YYYY-MM-DD.md`.

| Step | Actor | Action | Expected | Evidence location |
|---|---|---|---|---|
| 1 | Admin | Stack + `/api/health` | 200, `status: ok` | pilot-smoke `api_health` |
| 2 | Admin | Register case, viewing range `全員` | Saved; PATCH rejects empty ranges | `/register`, audit `case.create` |
| 3 | Operator | Upload PDF, auto-enable OFF | `extraction_status=succeeded`, RAG OFF | `/cases/:id`, `/jobs` |
| 4 | Operator | Enable `抽出後RAG自動ON`, re-upload | `auto_enable_rag_on_extraction=true` | attachment row |
| 5 | Operator | `/rag` | 未ナレッジ化候補 visible | stats card + table highlight |
| 6 | Operator | Enable RAG on extracted file | embedding job `pending`→`completed` | `/jobs?job_type=embedding` |
| 7 | Pilot | `/ai` query on in-range case | Citation with authorized `display_id` only | chat + audit `ai.chat` |
| 8 | Pilot | Query re `照会禁止` case | No citation/context leak | pilot-smoke `rag_eval` + manual spot-check |
| 9 | Pilot | `/search` or case list | Sees `全員` cases only, not analyst-only | switch user header / UI |
| 10 | Admin | `/audit?query_id=…` | `details_json.excluded_counts` present; no denied titles | audit detail dialog |
| 11 | Operator | `/jobs` retry failed job | Status → pending; audit `job.retry` | jobs table + audit |
| 12 | All | CI parity | Tests + build green | pilot-smoke summary |

## Go / No-Go criteria

| Decision | Condition |
|---|---|
| **Go** | All automated smoke steps ok; manual steps 2–11 ok or warn with documented owner+date; backup-check recorded; no open **err** blockers |
| **Conditional go** | Ollama warn only (step 1 ok, ollama warn); manual RAG/AI steps deferred 1 week with owner |
| **No-go** | Any **err** on permission regression (step 8), audit leak (step 10), or failed job retry broken (step 11) |

## Blocker → backlog routing

| Pattern | Route |
|---|---|
| UI/layout regression | M28 fix PR → re-run affected checklist rows |
| OCR/ASR needed (2+ pilot files) | Post-MVP per runbook cut criteria |
| Retrieval quality misses | M26 eval expansion + embedding model review |
| Missing audit keys | API fix + re-run step 10 |

## Persona header (dev)

Set in WebUI home or `localStorage` / request header:

- Admin: `X-AISSS-User-Id: 00000000-0000-4000-8000-000000000001`
- Operator: `00000000-0000-4000-8000-000000000002`
- Pilot: `00000000-0000-4000-8000-000000000003`
