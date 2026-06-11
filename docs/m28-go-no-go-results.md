# M28 Go / No-Go Results

Recorded: **2026-06-11** (dev/lab environment). Procedure: [m28-pilot-dry-run.md](./m28-pilot-dry-run.md).

## Decision

| Field | Value |
|---|---|
| **Decision** | **Conditional Go** |
| **Rationale** | Automated baseline (`pilot-smoke.ps1`) exit 0 after web redeploy; backup-check recorded; audit governance keys present. Manual persona walkthrough (steps 2–7, 9, 11) remains **warn** — operator production-like env pending. |
| **Blockers** | None (err) |
| **Owner follow-up** | Complete manual steps in operator env before wider pilot week |

## Automated baseline

Command: `pwsh scripts/pilot-smoke.ps1 -RecordBackupCheck -SkipBuild` (after `deploy-web.ps1`)

| Check | Status | Detail |
|---|---|---|
| api_health | ok | v0.2.0, git bfe90e7 in container after redeploy |
| ollama_health | ok | host reachable |
| rag_eval | ok | 10 scenarios pass |
| npm_test_api | ok | 54 pass, 5 skipped |
| npm_test_workers | ok | 20 pass |
| docker_verify | ok | CSS 49004B, build label bfe90e7 |
| admin_dashboard | ok | cases=3, failed_jobs=0, rag_chunks=4 |
| backup_check_recorded | ok | POST 201, scope=full-stack |

## Dry-run steps (12)

| Step | Actor | Status | Evidence / notes |
|---|---|---|---|
| 1 | Admin | ok | pilot-smoke `api_health` |
| 2 | Admin | warn | Manual: register case + `全員` — not re-run in this session |
| 3 | Operator | warn | Manual: PDF upload extract — seed data has attachments |
| 4 | Operator | warn | Manual: auto-RAG reservation toggle |
| 5 | Operator | warn | Manual: `/rag` 未ナレッジ化候補 UI |
| 6 | Operator | warn | Manual: RAG enable → embedding job |
| 7 | Pilot | warn | Manual: `/ai` in-range citation — stream UX verified separately (bfe90e7) |
| 8 | Pilot | ok | `rag-eval.test.ts` — 照会禁止 / out-of-range |
| 9 | Pilot | warn | Manual: pilot user list scope — CI `route-integration.test.ts` skipped locally |
| 10 | Admin | ok | Audit spot-check: `ai.chat` has `excluded_counts` + `retrieved_case_ids` |
| 11 | Operator | warn | Manual: job retry — `failed_jobs=0` on dashboard; retry flow not exercised |
| 12 | All | ok | pilot-smoke tests + build |

## Post-MVP backlog (from gate review)

| Item | Trigger | Priority |
|---|---|---|
| OCR/ASR implementation | 2+ pilot image/audio files blocked | Post-MVP |
| ReRank execution ON | Retrieval misses persist after eval loop | Post-MVP (policy: OFF until wired) |
| MAP search | User request / mock scope | Deferred |
| Operator persona walkthrough | M20–M22 checklist warn closure | Before wider pilot |
| Integration tests in CI | `INTEGRATION_DATABASE_URL` for step 9 automation | Ops |

## Sign-off references

- [20-webui-wiring-checklist.md § M28](./20-webui-wiring-checklist.md#m28-pilot-dry-run--go-no-go)
- [11-milestones.md § M28](./11-milestones.md#milestone-28-pilot-dry-run--go-no-go-closure)
- DevLog: `ObsidianVault/90_DevLog/2026-06-11.md`
