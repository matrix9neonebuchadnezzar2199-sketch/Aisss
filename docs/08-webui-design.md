# WebUI Design

> Interactive mockups: [webui.html](../mockups/webui.html), [case-detail.html](../mockups/case-detail.html)（GitHub 風 HTML プロトタイプ）

## Mock Status

The HTML mock implements a **subset** of this specification for design review. Full field lists and filters below are the **target** for implementation.

| Document | Role |
|---|---|
| [18-webui-mock-inventory-and-flows.md](./18-webui-mock-inventory-and-flows.md) | Screen inventory, operator flows, demo IDs, gaps |
| [03-sequence-diagrams.md](./03-sequence-diagrams.md) | API timing per screen action |
| [04-data-flow.md](./04-data-flow.md) | Stores touched per screen |

**Not in mock scope:** MAP search under 検索 (deferred Post-MVP). See [18 § Post-MVP](./18-webui-mock-inventory-and-flows.md#post-mvp-deferred).

## Purpose

The AISSS WebUI is the operational interface for registering, managing, searching, and governing cases. It is also the safest place to expose AI answers because it can display source permissions, handling restrictions, and audit information.

## Main Navigation (Sidebar)

### 登録

- **ケース（事象）** — case registration form (Excel import integrated here).

Standalone reference files are registered from **RAG 管理 → + 単独ファイル登録** (not a sidebar item).

### 検索

- **ケース（事象）** — metadata and full-text case search.
- **AI 検索** — permissioned RAG chat with model selector (same indent as other items: one full-width lead space before icon).

### 管理

- **RAG 管理** — tree navigator (ジャンル → 細部 → ファイル) plus list/search and RAG enablement (㋹). Nested under 管理 with other admin items.
- **モデル管理（API 連携）** — Ollama model list and role assignment via `api/ollama`.
- **マスタ管理** — editable master lists.
- **ユーザー・グループ管理** — users, groups, viewing-range-to-group mapping (mock implemented).
- **監査ログ** — `view-audit`; filter, sortable table, detail dialog, cross-links to cases / AI / RAG / permissions.
- **ジョブ状態** — `view-jobs`; filter, retry mock, cross-links from search/RAG stats cards.

All items under 管理 share the same left alignment. All sidebar items in the mock are navigable (no muted placeholders at this time).

Excel import is integrated into case registration. Attachment and extraction status appear on case detail, case search, and RAG management.

## Global Status

- **Ollama indicator** in header or sidebar footer: connected / degraded / down.
- Polls `GET /api/ollama/health` on an interval.
- When down, AI search input is disabled; model management shows last error.

## Case Registration Screen

**Mock:** `view-register` (`showView('register')`). **Implemented:** core sections, Excel autofill simulation, edit mode via `?edit={display_id}`, attachment list in edit, condition checkboxes. **Not in mock:** 備考1-6, キーワード, 処置, 保存期間, 情報収集者, 情報入手場所, 対応情報要求, 閲覧範囲（直接入力）, 資料登録者.

### Body field layout (registration / edit)

The four body fields are stored separately in the database but laid out vertically in the registration form (`form-body-stack`):

| Field | Layout |
|---|---|
| 1 要約 | Full width; standard height (`rows` ≈ 3) |
| 2 記事 | Full width; **largest** textarea (primary content; `rows` ≈ 8 or equivalent `min-height`) |
| 3 所見 | Full width; standard height |
| 4 その他参考事項 | Full width; standard height |

Read view (`case-detail.html`) continues to **join** the four sections with headings. See [18 § Layout Conventions](./18-webui-mock-inventory-and-flows.md#mock-layout-conventions).

The case form should be grouped by operational meaning:

| Section | Fields |
|---|---|
| Basic information | 表題, 要約, 資料番号, 分類番号, 資料区分. |
| Event information | 事象発生年月日（開始）, 事象発生年月日（終了）, 分類, 地域. |
| Source information | 資料源, 資料登録者, 情報収集者, 情報入手場所, 登録部署. |
| Handling and access | 閲覧範囲, 閲覧範囲（直接入力）, 条件, 条件（その他）, 取扱区分. |
| Evaluation | 信頼性, 正確性, ランク. |
| Body | 本文 1 要約, 本文 2 記事, 本文 3 所見, 本文 4 その他参考事項. |
| Notes | 処置, 備考1-6, 保存期間. |
| Attachments | Office, PDF, image, audio, text. |

The read view should join body sections into one body display with headings while preserving separate edit fields.

### Case detail and edit (overwrite)

**Mock:** `case-detail.html` — 3 demo cases; joined body; **編集** link. Edit flow **implemented** in mock (`CASE_EDIT_RECORDS` in [18](./18-webui-mock-inventory-and-flows.md#demo-display-id-cross-reference)).

- **ケース詳細** (`case-detail.html`) opens in a separate window/tab from search results.
- **編集** navigates to `webui.html?edit={case_id}` and loads the registration form in **edit mode** (same fields as new registration).
- Edit mode shows case ID badge, existing attachments (read-only list), **更新する** submit (maps to `PATCH /api/cases/{case_id}`), and hides Excel import.
- **閲覧範囲** changes in edit mode apply to the whole case and all attachments; RAG admin inherits the updated range after metadata resync.
- **キャンセル** returns to case detail without saving.
- RAG admin “ケースを開く” uses the same `?edit=` flow.

## Case Search Screen

**Mock:** `view-search`. **Implemented:** collapsible filter panel (4-row layout below), five filter controls in mock (keyword, 資料区分, 登録部署, ランク, 閲覧範囲), sortable columns, stats cards (job-related cards link to `view-jobs`), Ctrl/⌘+click and ↗ for new tab. **Add at implementation:** remaining filters below.

### Collapsible filter panel

- Toggle **検索条件** adds `.collapsed` on `#searchFilterPanel`.
- Collapsed state persists in `localStorage` (`aisss-search-filter-collapsed`).
- **Implementation note:** expanded `max-height` on the filter body must use `#searchFilterPanel:not(.collapsed) .filter-panel-body`. A bare ID selector (e.g. `#searchFilterPanel .filter-panel-body { max-height: 220px }`) overrides the collapsed `max-height: 0` and leaves an empty panel visible when closed.

### Filter layout (mock — four rows)

| Row | Controls |
|---|---|
| 1 | キーワード・全文検索 — **full width** |
| 2 | 資料区分, 登録部署, ランク — **same row**, compact width |
| 3 | 閲覧範囲 — **full width** (labels are often long) |
| 4 | **検索** button |

DOM: `search-filter-panel` with classes `search-filter-keyword`, `search-filter-masters`, `search-filter-viewing`, `search-filter-actions`.

Search filters (full spec):

- Keyword/full text.
- 表題.
- 資料番号.
- 資料区分.
- 登録部署.
- Event date range.
- 分類.
- 地域.
- 資料源.
- 対応情報要求.
- 取扱区分.
- 信頼性.
- 正確性.
- ランク.
- 条件.
- 閲覧範囲.
- 情報収集者.

Search results should show:

- Display ID.
- 表題.
- 要約.
- 資料区分.
- 登録部署.
- Event date range.
- Rank/reliability/accuracy.
- Handling labels.
- Attachment count.
- Extraction/RAG status.

## Attachment Panel

For each attachment:

- File name.
- Type.
- Size.
- Upload user and time.
- Extraction status.
- RAG sync status.
- Download button only when authorized.
- Extracted text preview only when authorized.
- Retry extraction action for operators.

## Excel Import Screen

**Mock:** Excel button on `view-register` only — file pick fills form fields with a toast (no preview/confirm UI).

Flow (full spec):

1. Upload template.
2. Preview parsed rows.
3. Show hard errors and warnings.
4. Confirm valid rows.
5. Show import result and background job status.

The preview must not commit any rows. Confirmed import must be auditable.

## AI Search Screen

**Mock:** `view-ai`. **Implemented:** model dropdown, policy banner, static sample Q&A with citation. **Not in mock:** live chat, streaming, Ollama-down disable.

The AI screen should:

- Authenticate through the same user identity as WebUI.
- Call `POST /api/ai/chat` (or streaming variant) which uses the permissioned search middleware internally.
- Let users **select a chat model** from `enabled_chat_models` (SaaS-style dropdown).
- Show Ollama connection status near the chat input.
- Display source citations with handling labels.
- Show effective output restrictions such as 印刷禁止 or 複製禁止.
- Disable export and print actions according to effective policy.
- Provide a link back to authorized case detail pages.
- Support streaming responses when implemented.

The AI screen must not show:

- Count or titles of denied cases.
- Raw vector search debug output to normal users.
- Storage keys or direct object URLs.

## Standalone File Registration Screen

**Mock:** `view-standalone-file` (no sidebar item). **Implemented:** form layout, tag input with history, viewing range select. **Not wired:** submit → API.

See [RAG Admin Guide](./16-rag-admin-guide.md).

Opened from **RAG 管理 → + 単独ファイル登録** (no sidebar entry under 登録).

Operators register reference files that are not tied to a full case record:

- Title (細部 group name), tags (new entry + history search; chips with per-tag × remove), viewing range.
- File upload (Office, PDF, image, audio).
- After save, extraction runs and the file appears under **単独ファイル（参照資料）** in the RAG tree.

## RAG Management Screen

**Mock:** `view-rag-admin`. **Implemented:** stats, RAGの体系管理 tree (㋹ cascade, counts), unified list with sort, 閲覧範囲 filter, case inheritance guard dialog, standalone range select, delete dialog, 再抽出 on failed row. **High completeness** — see [18 matrix](./18-webui-mock-inventory-and-flows.md#screen-completeness-matrix).

See [RAG Admin Guide](./16-rag-admin-guide.md).

Layout: **left panel「RAGの体系管理」** (genre / group / file tree with cascading ㋹ checkboxes) and **right panel** (search + list).

Genres (initial):

- **ケース（事象）** — files from case attachments and case-linked groups.
- **単独ファイル（参照資料）** — files from standalone registration.

Right panel (single view):

- Title, tag chips (history search, multi-select, × remove), date filters, and **閲覧範囲** filter.
- File table columns: 細部/ファイル, **閲覧範囲**, パイプライン, ㋹ RAG, 操作.
- **閲覧範囲** display:
  - Case attachments: inherited label + **ケース継承** badge (read-only). Click opens warning dialog; **ケースを開く** navigates to case form.
  - Standalone files: editable select; save applies `PATCH /api/rag/standalone-files/{id}/viewing-ranges`.
- Per-row **削除** (warning dialog); retry extraction on failed rows; save applies RAG enablement changes.

See [Viewing Range Permission Flow](./17-viewing-range-permission-flow.md) for the full operator flow (register with A/B → verify in RAG admin).

Registration paths (not upload on this screen):

1. **ケース添付** — 登録 → ケース（事象）.
2. **単独ファイル** — **+ 単独ファイル登録** on RAG 管理.

Fine-grained hierarchy rules (細部 naming) are TBD after mock review.

## Model Management Screen

**Mock:** `view-models`. **Implemented:** sortable model table, default/ReRank settings (static).

See [Ollama Integration Guide](./15-ollama-integration.md).

Administrators use this screen to:

- List models from host Ollama via `GET /api/ollama/models`.
- Assign roles: chat, embedding, rerank.
- Set default chat and embedding models.
- Configure `enabled_chat_models` for the AI search dropdown.
- Toggle ReRank (effective only when `rerank_model` is set).
- View Ollama health latency and last check time.

Model pull and delete remain host CLI operations in the initial release.

## Master Management

**Mock:** `view-masters`. **Implemented:** master type select, sample rows, sort. **Not in mock:** full CRUD for all master types.

Operators can manage:

- 資料区分.
- 登録部署.
- 分類.
- 地域.
- 資料源.
- 対応情報要求.
- 条件.
- 閲覧範囲.
- 取扱区分.
- 信頼性.
- 正確性.
- ランク.
- 保存期間.
- キーワード.
- 情報入手場所.

Each master value should support active/inactive status rather than hard deletion.

## Permission Management

**Mock:** `view-permissions`. **Implemented:** ユーザー / グループ / 閲覧範囲マッピング tabs, sortable tables, demo A/B mapping rows.

See [Viewing Range Permission Flow](./17-viewing-range-permission-flow.md). Operator flow: [18 § Flow A](./18-webui-mock-inventory-and-flows.md#flow-a-permission-bootstrap-administrator).

Operators can manage:

- Users and group membership (tabs: ユーザー / グループ).
- **閲覧範囲マッピング** — which groups may access each viewing range (`group_viewing_ranges`).
- Roles for admin, operator, reviewer, and general user.

**マスタ管理** defines viewing range *labels*; **ユーザー・グループ管理** defines *who* can access each range. Permission changes should trigger RAG metadata update or reindex jobs.

## Audit Log Screen

**Mock:** `view-audit`. **Implemented:** stats, sortable table, row/detail dialog, links to `case-detail.html`, `view-ai`, `view-rag-admin`, `view-permissions`, `view-masters`, case edit via `?edit=`. **Not in mock:** live API, export, pagination.

### Filter layout (mock — two rows)

| Row | Controls |
|---|---|
| 1 | ユーザー, アクション（カテゴリ）, 日付範囲（開始 〜 終了） |
| 2 | 表示 ID / クエリ ID, **絞り込み** button |

DOM: `audit-filter-panel` with `audit-filter-row` rows; date range wrapped in `audit-date-range`.

Operators should be able to filter by:

- User.
- Case.
- Action type.
- Date range.
- IP or client identifier if collected.
- AI query ID.

Sensitive audit records should avoid exposing restricted case content to operators who do not have audit authority.

## Job Status Screen

**Mock:** `view-jobs`. **Implemented:** stats (running / pending / failed / completed today), type and status filters, sortable job table, **再試行** toast (status → pending), **監査** jump to audit filtered by case, clickable stats on **ケース検索** and **RAG 管理** (`data-jobs-nav`). Deep link: `webui.html?view=jobs&filter=failed`. **Not in mock:** live polling, dead-letter admin workflow beyond button stub.

Lists extraction, embedding, and `rag_metadata_sync` jobs; maps to `GET /api/jobs` and `POST /api/jobs/{job_id}/retry`.

## UX Rules

- Clearly mark cases with handling restrictions.
- Use autocomplete for master selections.
- Warn when a direct text field is used instead of structured viewing range.
- Show background processing state rather than blocking the user.
- Keep destructive actions behind confirmation and audit logging.
- **Sortable tables:** column headers toggle asc/desc on case search, RAG list, models, masters, and permission tables (implemented in mock).
- **Sidebar collapse:** toggle persists in `localStorage` (`aisss-sidebar-collapsed`).
- **Search filter collapse:** filter panel collapse persists (`aisss-search-filter-collapsed`); collapsed panel shows header only (no empty body area).
- **Case comparison:** open multiple `case-detail.html` tabs via Ctrl+click (Mac: ⌘+click) or ↗ button.
- **Long master labels (閲覧範囲):** use a full-width filter row in case search so long values remain readable.
- **Compact masters (資料区分, 登録部署, ランク):** may share one filter row with constrained width.
- **Body 記事:** the largest textarea in the registration form; other body sections use standard height.
