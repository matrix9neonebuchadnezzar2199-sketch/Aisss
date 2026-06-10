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
| AI 検索 | `/ai` | `POST /api/ai/chat`, `GET /api/ollama/health` | C |
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
