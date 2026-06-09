# WebUI Design

## Purpose

The Aisss WebUI is the operational interface for registering, managing, searching, and governing cases. It is also the safest place to expose AI answers because it can display source permissions, handling restrictions, and audit information.

## Main Navigation

- Dashboard.
- Case search.
- Case registration.
- Excel import.
- Attachments and extraction status.
- AI search.
- Master management.
- User and group management.
- Audit logs.
- System jobs.

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
- Call Dify only through a workflow that uses the permissioned search middleware.
- Display source citations with handling labels.
- Show effective output restrictions such as 印刷禁止 or 複製禁止.
- Disable export and print actions according to effective policy.
- Provide a link back to authorized case detail pages.

The AI screen must not show:

- Count or titles of denied cases.
- Raw vector search debug output to normal users.
- Storage keys or direct object URLs.

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
