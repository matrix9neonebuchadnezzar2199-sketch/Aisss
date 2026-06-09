# Requirements

## Goal

AISSS builds a case management system and a permissioned RAG tool with native Ollama integration. Users register cases, metadata, attachments, and extracted text through the WebUI. Authorized users can then search, summarize, and ask questions over those materials through AISSS AI chat without bypassing case-level access control.

## Scope

In scope:

- Case registration and editing.
- Metadata management using editable WebUI master lists.
- Attachment storage for Office documents, PDFs, images, audio, and extracted text.
- Excel-based bulk import.
- Text extraction from Office, PDF, image OCR, and audio ASR.
- RAG synchronization to vector search.
- Native AI chat with Ollama (embeddings, completion, optional rerank).
- RAG administration and model management in WebUI.
- User, group, viewing range, and handling condition based access control.
- Audit logs for registration, update, view, download, AI query, and export.

Out of scope for the first implementation:

- Fully automated classification of sensitive materials.
- Native image similarity search.
- External AI tools as the permission authority without AISSS middleware.
- Public internet lookup of registered indicators or document content.

## Users and Scale

- Approximately 1,000 users.
- Expected concurrent active users: 10 to 20 at the initial stage.
- Operators manage master lists, permissions, and import templates.
- General users register, search, view, and ask AI questions according to their permissions.

## Case Fields

The following fields are part of the initial case model.

| Field | Input Type | Storage Approach | Notes |
|---|---|---|---|
| 資料区分 | Master selection | `material_type_id` | WebUI editable master recommended. |
| 登録部署 | Master selection | `registering_department_id` | Also used for access and audit. |
| 事象発生年月日（開始） | Date | `event_start_date` | Date type, not string. |
| 事象発生年月日（終了） | Date, optional | `event_end_date` | Nullable for single-date events. |
| 分類 | Master selection | `category_id` | WebUI editable master recommended. |
| 地域 | Master selection | `region_id` | WebUI editable master recommended. |
| 資料源 | Master selection | `source_id` | WebUI editable master recommended. |
| 資料登録者 | User/person reference | `registrant_id` | Prefer user/person master. |
| 対応情報要求 | Master selection | `information_request_id` | Must be WebUI editable and selectable. |
| 資料番号 | Text | `material_number` | Human-facing identifier. |
| 条件 | Multi-select master | `case_conditions` | Checkbox values. Add/edit through WebUI. |
| 条件（その他） | Text | `condition_notes` | Free text supplement. |
| 閲覧範囲 | Group/range selection | `case_viewing_ranges` | Permission source. |
| 閲覧範囲（直接入力） | Text | `viewing_range_note` | For exceptional notes, not primary ACL. |
| 情報収集者 | Person reference | `case_collectors` | Multi-value recommended. |
| 情報入手場所 | Master/text | `acquisition_location_id` or text | Decide master strictness during UI design. |
| 取扱区分 | Master selection | `handling_type_id` | Must be WebUI editable and selectable. |
| 信頼性 | Master selection | `reliability_id` | Must be WebUI editable and selectable. |
| 正確性 | Master selection | `accuracy_id` | Must be WebUI editable and selectable. |
| ランク | Master selection | `rank_id` | Must be WebUI editable and selectable. |
| 処置 | Text | `action_taken` | Operational follow-up. |
| 備考1-6 | Text | `note_1` to `note_6` | Keep explicit columns for import compatibility. |
| 分類番号 | Text | `classification_number` | Separate from category master. |
| 保存期間 | Master/date policy | `retention_policy_id` | Prefer master plus retention date calculation. |
| 表題 | Text | `title` | Required. |
| 要約 | Text | `summary` | Short human-authored summary. |
| キーワード1-6 | Multi-value text/master | `case_keywords` | Excel columns are split; DB stores normalized values. |
| 本文 1 要約 | Text | `body_summary` | Stored separately. |
| 本文 2 記事 | Text | `body_article` | Stored separately. |
| 本文 3 所見（分析・評価） | Text | `body_assessment` | Stored separately. |
| 本文 4 その他参考事項 | Text | `body_reference` | Stored separately. |

## Body Handling

Excel may keep the four body sections in separate cells. The database also stores them separately. The WebUI displays them as one joined body with generated section headings:

1. 要約
2. 記事
3. 所見（分析・評価）
4. その他参考事項

This preserves structure for RAG weighting while matching the requested single-body view.

**Registration and edit UI:** The four body sections appear as **separate full-width fields stacked vertically** (要約 → 記事 → 所見 → その他参考). The **記事** field is the primary content area and uses the largest textarea. **Read-only case detail** continues to show the four sections as one joined body with headings (see [08 § Body field layout](./08-webui-design.md#body-field-layout-registration--edit)).

## Attachment Requirements

Supported attachment types:

- Office documents: `docx`, `xlsx`, `pptx`, and compatible formats after policy approval.
- PDF files.
- Images for OCR.
- Audio files for ASR.
- Plain text or text manually produced from audio.

Each attachment must be linked to a case UUID and must have extraction status, file hash, storage key, media type, size, uploader, and timestamps.

## AI and RAG Requirements

- AISSS WebUI and API provide AI chat, RAG administration, and model management.
- Ollama on the host provides embeddings, chat completion, and optional reranking.
- Vector search must be permission-filtered before content reaches LLM generation.
- All searchable content originates from AISSS cases and attachments; there is no parallel direct-upload knowledge path.
- Users can select an enabled chat model in the AI search screen.
- Ollama health must be visible in the WebUI.
- ReRank is optional and off by default (ADR-005).
- Every RAG chunk must include source metadata: case UUID, attachment ID when applicable, source type, viewing range, handling conditions, registration department, dates, rank, reliability, accuracy, and keywords.

## Non-Functional Requirements

- Access control must fail closed.
- Permission-denied documents must not appear in search results, citations, or AI answers.
- Long-running extraction and embedding jobs must run asynchronously.
- Case create/update/delete and permission changes must be auditable.
- The system must support backup and restore of PostgreSQL metadata and object storage.
- The design should work in restricted or air-gapped environments.

## Success Criteria

- A user can register a case with metadata, body sections, handling conditions, viewing range, and attachments.
- The system extracts text from supported attachments and links the result to the case.
- Authorized AI queries return only documents the user can view.
- Unauthorized users cannot infer the existence of restricted cases from AI responses.
- Operators can add or edit master list values from the WebUI.
- Excel import supports preview, validation, error reporting, and confirmed registration.

## Open Decisions

- Exact SSO or identity provider.
- Final vector database choice.
- OCR and ASR engines.
- Whether `情報入手場所` is a strict master or flexible text plus suggestions.
- Exact legal and organizational interpretation of each handling condition.
