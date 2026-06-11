# WebUI Wiring Checklist (M19)

Per-screen verification that React UI calls the correct APIs and navigation matches [18 § Operator Flows](./18-webui-mock-inventory-and-flows.md#operator-flows).

## How to verify each screen

| Check | Method |
|---|---|
| API | Browser DevTools Network — path, method, status |
| Auth | Switch `X-AISSS-User-Id` (admin / operator / pilot) |
| Navigation | Follow Flow A / B / C in mock order |
| Regression | `npm test -w @aisss/api` and `npm run build -w @aisss/web` |

## Screen × API matrix

| Screen | Route | Primary APIs | Flow |
|---|---|---|---|
| ケース検索 | `/search` | `GET /api/cases`, masters for filters | B |
| ケース詳細 | `/cases/:displayId` | `GET /api/cases/by-display-id/{id}`, attachments download | B |
| ケース登録・編集 | `/register`, `?edit=` | `POST/PATCH /api/cases`, attachments, Excel import | B |
| ユーザー・グループ | `/permissions` | `GET/PUT /api/users`, `/api/groups`, viewing-range groups | A |
| マスタ管理 | `/masters` | `GET/POST/PATCH /api/masters/*` | A |
| RAG 管理 | `/rag` | `GET /api/rag/*`, enable, delete, reindex | B, C |
| 単独ファイル | `/rag/standalone` | `POST /api/rag/standalone-files` | C |
| AI 検索 | `/ai` | `POST /api/ai/chat/stream`, `GET /api/ollama/health` | C |
| モデル管理 | `/models` | `GET /api/ollama/models`, `PUT /api/admin/ollama/model-roles` | — |
| 監査ログ | `/audit` | `GET /api/audit-logs`, CSV export | dry-run 10 |
| ジョブ状態 | `/jobs` | `GET /api/jobs`, retry, dead-letter | dry-run 11 |
| 管理ダッシュボード | `/admin` | `GET /api/admin/dashboard` | M7 (header submenu) |
| 本番パイロット | `/pilot` | `GET/POST /api/pilot/feedback` | M7 (header submenu) |

## Cross-navigation (required)

| From | Action | Target |
|---|---|---|
| Search stats cards | Click pipeline counts | `/jobs?status=&job_type=` |
| Jobs row | 監査 | `/audit?case={display_id}` |
| Audit row | Case / AI follow | `/register?edit=` or `/ai` |
| RAG admin | ケースを開く | `/register?edit={display_id}` (new tab optional) |
| Register edit | キャンセル | `/cases/{display_id}` new tab |
| Search table | 表題 / display_id | `/cases/{display_id}` **new tab** |

## M19 sign-off

Record in `90_DevLog/` when all rows are checked ok for admin, operator, and pilot personas.

### 2026-06-10 — M19 implementation complete

| Check | Result |
|---|---|
| `npm run build -w @aisss/web` | ok |
| Design tokens + mock CSS | `styles/mock-webui.css`, `mock-case-detail.css`, `app-overrides.css` |
| App shell | GhHeader, AppSidebar, AppLayout, CaseDetailLayout standalone |
| 11 mock views + case-detail | All routes wired; `/` → `/search` |
| Cross-nav | Search stats→jobs URL params; jobs 監査→audit; audit→edit/AI; RAG ケースを開く→register new tab; register cancel→detail new tab; search links new tab |
| PermissionsPage | 3 tabs + API (`/api/users`, `/api/groups`, `/api/viewing-ranges`) |

Manual persona walkthrough (admin/operator/pilot): pending operator verification in pilot environment.

## M20 follow-up regression

Post-M19 UX fixes. Record results in `90_DevLog/` when checked.

| Area | Check | Expected |
|---|---|---|
| AI search | Send question → navigate away → return `/ai` | User + assistant messages visible; active session restored from localStorage |
| AI search | While generating | “考え中…” spinner shown; copy/print hidden until done |
| RAG tree | Left panel “RAGの体系管理” | Genre → group (case title) → file hierarchy from `GET /api/rag/tree` |
| RAG tree | Select genre/group/file | Right table filters to matching rows only |
| RAG tree | Empty standalone genre | Count shows `０` (full-width zero) |
| RAG status | Failed extraction file (e.g. budget-table.xlsx) | Red `×` in tree + table; row light-red background; red “抽出失敗” label |
| RAG status | RAG enabled file | Green `●` mark; green “RAG有効” label |
| Sidebar | Click `‹` collapse | `.layout.sidebar-collapsed` toggles; main content expands |
| Admin filters | Collapse filter panel → reload | `localStorage` key per page restores collapsed state |
| RAG dashboard | Stats row 2 | Storage breakdown donut + category cards from API |
| Deploy | After code change | `pwsh scripts/deploy-web.ps1` or api+web rebuild + `verify-docker-deploy.ps1` exit 0 |

### M20 change inventory (2026-06-11)

| Category | Files |
|---|---|
| AI search | `hooks/useAiChatHistory.ts`, `pages/AiSearchPage.tsx`, `components/ai/AiMessageList.tsx` |
| RAG admin | `pages/RagAdminPage.tsx`, `components/rag/*`, `api/services/rag-admin.ts`, `rag-storage-breakdown.ts` |
| Common UI | `CollapsibleFilterPanel.tsx`, `FormGroup.tsx`, `AppLayout.tsx`, `AppSidebar.tsx`, `useFilterPanelCollapsed.ts`, admin pages |
| API | `audit-stats.ts`, `routes/audit.ts`, `lib/api.ts` |
| Styles | `app-overrides.css` |

### M20 sign-off

| Check | Result |
|---|---|
| `npm run build -w @aisss/web` | ok (2026-06-11) |
| `npm test -w @aisss/api` | ok — 48 pass, 5 skipped (integration) |
| `verify-docker-deploy.ps1` | ok — CSS 43620B, build label present |
| Regression table above | ok — automated API tests + build/deploy verify (2026-06-11); pilot browser walkthrough: warn (operator env pending) |

## M21 follow-up regression

RAG Admin Full Operations (mock `view-rag-admin` parity). Record results in `90_DevLog/` when checked.

| Area | Check | Expected |
|---|---|---|
| RAG delete | Click 削除 on attachment row → confirm | Row removed; Qdrant chunks purged; audit log `attachment.delete` |
| RAG delete | Click 削除 on standalone row → confirm | Soft-deleted; storage object removed; audit `standalone_file.delete` |
| RAG delete | Cancel dialog | No API call; row remains |
| Viewing range | Case attachment: click ケース継承 | Guard dialog → ケースを開く navigates to register edit |
| Viewing range | Standalone: change `<select>` | `PATCH …/viewing-ranges`; metadata sync job enqueued |
| Filters | Tag + date range + 検索 | `GET /api/rag/files` with `tag`, `date_from`, `date_to` |
| Sort | Click column headers | Table re-sorts (file / viewing range / pipeline / RAG) |
| Bulk reindex | 一括再インデックス button | `POST /api/rag/bulk-reindex`; embedding jobs enqueued for RAG-enabled sources |
| Deploy | After code change | api + web rebuild + `verify-docker-deploy.ps1` exit 0 |

### M21 change inventory (2026-06-11)

| Category | Files |
|---|---|
| RAG admin UI | `pages/RagAdminPage.tsx`, `components/rag/RagDeleteDialog.tsx`, `RagCaseViewingDialog.tsx`, `rag-file-sort.ts` |
| API | `services/rag-admin.ts`, `services/attachments.ts`, `routes/rag.ts`, `routes/attachments.ts`, `routes/cases.ts` |
| Client | `lib/api.ts` |
| Docs | `docs/11-milestones.md`, `docs/20-webui-wiring-checklist.md` |

### M21 sign-off

| Check | Result |
|---|---|
| `npm run build -w @aisss/web` | ok (2026-06-11) |
| `npm test -w @aisss/api` | ok — 48 pass, 5 skipped |
| `verify-docker-deploy.ps1` | ok — CSS 43620B, build label present |
| Regression table above | ok — automated API tests + build/deploy verify (2026-06-11); pilot browser walkthrough: warn (operator env pending) |

## M22 follow-up regression

Pilot regression closure after M21 RAG delete FK fix and extended search/register work.

| Area | Check | Expected |
|---|---|---|
| RAG delete | DELETE attachment after jobs exist | 200; no `jobs_attachment_id_fkey` 500 |
| RAG pipeline | PDF/DOCX/TXT case attachment | extract → embed → AI citation path |
| Search filters | Extended GET `/api/cases` query params | title, masters, dates, condition filter |
| Register | 備考1-6, keywords, collectors, masters | PATCH persists; case detail shows values |
| Excel import | Template v2 columns | preview/confirm matches register fields |
| AI search | Stream response | SSE tokens render incrementally; Ollama down disables input |
| Permission | pilot user outside range | restricted cases absent from search/AI |

### M22 change inventory (2026-06-11)

| Category | Files |
|---|---|
| Regression tests | `m22-regression.test.ts`, `case-search-query.test.ts` |
| Search/Register | `cases.ts`, `case-search-query.ts`, `RegisterPage.tsx`, `SearchPage.tsx`, migration `011_*` |
| RAG input | `workers/src/extract.js`, xlsx dependency |
| AI UX | `api.ts` `sendAiChatStream`, `AiSearchPage.tsx`, `useAiChatHistory.ts` |
| Eval/Ops docs | `eval/retrieval-eval-set.json`, `19-operational-runbook.md` |

### M22 sign-off

| Check | Result |
|---|---|
| `npm run build -w @aisss/web` | ok (2026-06-11) |
| `npm test -w @aisss/api` | ok — 54 pass, 5 skipped |
| `npm test -w @aisss/workers` | ok |
| `verify-docker-deploy.ps1` | ok |
| Regression table above | ok — API/unit coverage; pilot browser walkthrough: warn |

## M28 Pilot Dry Run / Go-No-Go

Wider pilot gate. Full procedure: [m28-pilot-dry-run.md](./m28-pilot-dry-run.md). Results: [m28-go-no-go-results.md](./m28-go-no-go-results.md).

### Automated baseline

```powershell
pwsh scripts/pilot-smoke.ps1 -RecordBackupCheck
```

### Manual persona walkthrough

| Step | Area | Actor | Expected |
|---|---|---|---|
| 2 | Case register + viewing range | Admin | `全員` required; PATCH rejects empty |
| 3–4 | Attachment extract + auto-RAG reservation | Operator | extract ok; reservation flag stored |
| 5–6 | RAG admin enable + embedding | Operator | 未ナレッジ化候補 → job completed |
| 7–9 | AI + permission list | Pilot | in-range citation only; no analyst-only leak |
| 10 | Audit AI query | Admin | `excluded_counts`; no denied titles |
| 11 | Job retry | Operator | retry → pending; audit `job.retry` |

### Go / No-Go

| Decision | Criteria |
|---|---|
| Go | `pilot-smoke.ps1` exit 0; steps 2–11 ok or documented warn; backup-check recorded |
| No-go | err on step 8 (permission), 10 (audit leak), or 11 (retry broken) |

### M28 sign-off

| Check | Result |
|---|---|
| `pwsh scripts/pilot-smoke.ps1 -RecordBackupCheck` | ok (2026-06-11, exit 0 after web redeploy bfe90e7) |
| Manual steps 2–7, 9, 11 | warn — operator env pending |
| Automated step 8 (rag-eval) + 10 (audit keys) | ok |
| `docs/m28-go-no-go-results.md` | ok — **Conditional Go** |
| DevLog M28 entry | ok (2026-06-11) |
