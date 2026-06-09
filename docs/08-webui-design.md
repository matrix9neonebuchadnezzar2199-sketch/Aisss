# WebUI Design

> Interactive mockup: [mockups/webui.html](../mockups/webui.html)（GitHub 風 HTML プロトタイプ）

## Purpose

The AISSS WebUI is the operational interface for registering, managing, searching, and governing cases. It is also the safest place to expose AI answers because it can display source permissions, handling restrictions, and audit information.

## Main Navigation (Sidebar)

### 登録

- **ケース（事象）** — case registration form (Excel import integrated here).
- **単独ファイル（参照資料）** — standalone file upload without full case metadata (peer with ケース（事象） under 登録).

### 検索

- **ケース（事象）** — metadata and full-text case search.
- **AI 検索** — permissioned RAG chat with model selector (same indent as other items: one full-width lead space before icon).

### 管理

- **RAG 管理** — tree navigator (ジャンル → 細部 → ファイル) plus list/search and RAG enablement (㋹). Nested under 管理 with other admin items.
- **モデル管理（API 連携）** — Ollama model list and role assignment via `api/ollama`.
- **マスタ管理** — editable master lists.
- **ユーザー・グループ管理** — planned; mock not yet implemented.
- **監査ログ** — planned; mock not yet implemented.
- **ジョブ状態** — planned; mock not yet implemented.

All items under 管理 share the same left alignment. Placeholder items are shown muted until screens exist.

Excel import is integrated into case registration. Attachment and extraction status appear on case detail, case search, and RAG management.

## Global Status

- **Ollama indicator** in header or sidebar footer: connected / degraded / down.
- Polls `GET /api/ollama/health` on an interval.
- When down, AI search input is disabled; model management shows last error.

## Case Registration Screen

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

## Case Search Screen

Search filters:

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

Flow:

1. Upload template.
2. Preview parsed rows.
3. Show hard errors and warnings.
4. Confirm valid rows.
5. Show import result and background job status.

The preview must not commit any rows. Confirmed import must be auditable.

## AI Search Screen

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

See [RAG Admin Guide](./16-rag-admin-guide.md).

Operators register reference files that are not tied to a full case record:

- Title (細部 group name), tags (new entry + history search; chips with per-tag × remove), viewing range.
- File upload (Office, PDF, image, audio).
- After save, extraction runs and the file appears under **単独ファイル（参照資料）** in the RAG tree.

## RAG Management Screen

See [RAG Admin Guide](./16-rag-admin-guide.md).

Layout: **left tree** (ジャンル → 細部 → ファイル) and **right panel** (search + list).

Genres (initial):

- **ケース（事象）** — files from case attachments and case-linked groups.
- **単独ファイル（参照資料）** — files from standalone registration.

Right panel (single view):

- Title, tag chips (history search, multi-select, × remove), and date filters.
- File table: pipeline status (抽出済 / 埋め込み待ち / 抽出失敗) and ㋹ RAG toggle per row in one screen.
- Retry extraction on failed rows; save applies RAG enablement changes.

Registration paths (not upload on this screen):

1. **ケース添付** — 登録 → ケース（事象）.
2. **単独ファイル** — 登録 → 単独ファイル（参照資料）, or **+ 単独ファイル登録** on RAG 管理.

Fine-grained hierarchy rules (細部 naming) are TBD after mock review.

## Model Management Screen

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

Operators can manage:

- Users.
- Groups.
- Group membership.
- Viewing range definitions.
- Viewing range to group mapping.
- Roles for admin, operator, reviewer, and general user.

Permission changes should trigger RAG metadata update or reindex jobs.

## Audit Log Screen

Operators should be able to filter by:

- User.
- Case.
- Action type.
- Date range.
- IP or client identifier if collected.
- AI query ID.

Sensitive audit records should avoid exposing restricted case content to operators who do not have audit authority.

## UX Rules

- Clearly mark cases with handling restrictions.
- Use autocomplete for master selections.
- Warn when a direct text field is used instead of structured viewing range.
- Show background processing state rather than blocking the user.
- Keep destructive actions behind confirmation and audit logging.
