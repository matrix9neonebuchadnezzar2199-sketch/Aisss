# Sequence Diagrams

> Screen IDs and mock coverage: [WebUI Mock Inventory and Flows](./18-webui-mock-inventory-and-flows.md).

## Case Registration with Attachments

```mermaid
sequenceDiagram
  actor User
  participant WebUI as AISSS WebUI
  participant API as Backend API
  participant DB as PostgreSQL
  participant Storage as Object Storage
  participant Queue as Job Queue

  User->>WebUI: Enter case metadata and upload attachments
  WebUI->>API: Create case request
  API->>DB: Validate master IDs and permissions
  API->>DB: Insert case and metadata
  API->>Storage: Store original attachments
  API->>DB: Insert attachment records
  API->>Queue: Enqueue extraction jobs
  API-->>WebUI: Case created with processing status
  WebUI-->>User: Show case detail and pending extraction
```

**Mock:** `view-register` (登録 → ケース（事象）). Excel import button uses a simplified autofill in the mock; full preview flow is in [Excel Import](#excel-import).

→ Details: [18 § Flow B](./18-webui-mock-inventory-and-flows.md#flow-b-case-lifecycle-register--search--detail--edit--rag)

## Case Search, Detail, and Edit

```mermaid
sequenceDiagram
  actor User
  participant Search as view-search
  participant Detail as case-detail.html
  participant Edit as view-register
  participant API as Backend API
  participant DB as PostgreSQL

  User->>Search: Filter and open case link
  Search->>Detail: Navigate ?case=display_id
  Detail->>API: GET /api/cases/{case_id}
  API->>DB: Permission check and load
  DB-->>API: Case body sections and metadata
  API-->>Detail: Authorized case detail
  User->>Detail: Click 編集
  Detail->>Edit: webui.html?edit=display_id
  Edit->>API: GET /api/cases/{case_id}
  API-->>Edit: Prefill form
  User->>Edit: Submit 更新する
  Edit->>API: PATCH /api/cases/{case_id}
  API->>DB: Update case and viewing ranges
  API-->>Edit: Update accepted
  Edit-->>User: Toast; optional return to detail
```

**Mock:** Search table links to `case-detail.html`; **編集** and RAG **ケースを開く** use `?edit=` with `CASE_EDIT_RECORDS`.

→ Details: [18 § Flow B](./18-webui-mock-inventory-and-flows.md#flow-b-case-lifecycle-register--search--detail--edit--rag), [08 § Case detail and edit](./08-webui-design.md)

## Text Extraction and RAG Indexing

```mermaid
sequenceDiagram
  participant Queue as Job Queue
  participant Extractor as Extraction Worker
  participant Storage as Object Storage
  participant DB as PostgreSQL
  participant Embedder as Embedding Worker
  participant Vector as Vector DB

  Queue->>Extractor: Run extraction job
  Extractor->>Storage: Read original file
  Extractor->>Extractor: Parse Office PDF OCR or ASR
  Extractor->>DB: Save extracted text and status
  Extractor->>Queue: Enqueue embedding job
  Queue->>Embedder: Run embedding job
  Embedder->>DB: Load case metadata and permissions
  Embedder->>DB: Create RAG chunks with metadata
  Embedder->>Vector: Upsert embeddings with metadata
  Embedder->>DB: Mark chunks synced
```

**Mock:** Pipeline status labels appear in `view-search` (状態 column) and `view-rag-admin` (パイプライン column).

## Excel Import

```mermaid
sequenceDiagram
  actor Operator
  participant WebUI as AISSS WebUI
  participant API as Backend API
  participant DB as PostgreSQL
  participant Queue as Job Queue

  Operator->>WebUI: Upload Excel workbook
  WebUI->>API: Preview import
  API->>API: Parse workbook rows
  API->>DB: Resolve master values and UUIDs
  DB-->>API: Validation references
  API-->>WebUI: Row preview with errors
  Operator->>WebUI: Confirm valid rows
  WebUI->>API: Confirm import
  API->>DB: Insert or update cases
  API->>Queue: Enqueue extraction and embedding jobs
  API-->>WebUI: Import result
```

**Mock:** `view-register` Excel button only simulates row parse into the form (no preview/confirm UI yet).

→ Backlog: [18 § Mock vs Specification Gaps](./18-webui-mock-inventory-and-flows.md#mock-vs-specification-gaps-backlog)

## AI Question Answering

```mermaid
sequenceDiagram
  actor User
  participant WebUI as AISSS WebUI
  participant API as AISSS API
  participant Search as Permissioned Search Middleware
  participant DB as PostgreSQL
  participant Vector as Vector DB
  participant Ollama as Ollama Host
  participant Audit as Audit Log

  User->>WebUI: Ask question and select model
  WebUI->>API: POST /api/ai/chat
  API->>Search: Request context with session user identity
  Search->>DB: Load user groups and permission scope
  Search->>Vector: Search only eligible metadata scope
  Vector-->>Search: Candidate chunks
  Search->>DB: Re-check cases and handling conditions
  DB-->>Search: Authorized chunks and output policies
  Search->>Audit: Record retrieval event
  Search-->>API: Safe context and policies
  API->>Ollama: Generate answer from safe context
  Ollama-->>API: Generated answer
  API->>Audit: Record answer event
  API-->>WebUI: Answer with allowed citations
  WebUI-->>User: Display answer
```

**Mock:** `view-ai` shows a static sample answer and citation for `CASE-2026-00142`.

## Permission Bootstrap (Administrator Setup)

```mermaid
sequenceDiagram
  actor Admin
  participant Masters as view-masters
  participant Perms as view-permissions
  participant API as Backend API
  participant DB as PostgreSQL

  Admin->>Masters: Add 閲覧範囲 master values
  Masters->>API: POST /api/masters/viewing_ranges
  API->>DB: Insert viewing_ranges
  Admin->>Perms: Create groups
  Perms->>API: POST /api/groups
  API->>DB: Insert groups
  Admin->>Perms: 閲覧範囲マッピング tab
  Perms->>API: PUT /api/viewing-ranges/{id}/groups
  API->>DB: Upsert group_viewing_ranges
  Admin->>Perms: Assign users to groups
  Perms->>API: PUT /api/groups/{group_id}/members
  API->>DB: Upsert user_groups
```

→ Details: [18 § Flow A](./18-webui-mock-inventory-and-flows.md#flow-a-permission-bootstrap-administrator), [17](./17-viewing-range-permission-flow.md)

## Standalone File Registration

```mermaid
sequenceDiagram
  actor Operator
  participant RAG as view-rag-admin
  participant Standalone as view-standalone-file
  participant API as Backend API
  participant Storage as Object Storage
  participant Queue as Job Queue

  Operator->>RAG: + 単独ファイル登録
  RAG->>Standalone: showView standalone-file
  Operator->>Standalone: Title, tags, viewing range, upload
  Standalone->>API: POST /api/rag/standalone-files
  API->>Storage: Store original
  API->>Queue: Enqueue extraction
  API-->>Standalone: File registered
  Operator->>RAG: Verify in 単独ファイル genre tree
```

→ Details: [18 § Flow C](./18-webui-mock-inventory-and-flows.md#flow-c-standalone-file--rag--ai-citation), [16](./16-rag-admin-guide.md)

## RAG Viewing Range Guard → Case Edit

```mermaid
sequenceDiagram
  actor Operator
  participant RAG as view-rag-admin
  participant Dialog as Case viewing dialog
  participant Edit as view-register
  participant API as Backend API

  Operator->>RAG: Click case attachment 閲覧範囲
  RAG->>Dialog: Show warning (ケース継承)
  Operator->>Dialog: ケースを開く
  Dialog->>Edit: webui.html?edit=display_id
  Edit->>API: GET /api/cases/{case_id}
  Note over API: PATCH on case_attachment viewing range returns 409 change_on_case_form
```

→ Details: [17](./17-viewing-range-permission-flow.md), [09 § RAG Admin](./09-api-design.md#rag-administration-apis)

## RAG File Delete

```mermaid
sequenceDiagram
  actor Operator
  participant RAG as view-rag-admin
  participant API as Backend API
  participant DB as PostgreSQL
  participant Queue as Job Queue
  participant Vector as Vector DB

  Operator->>RAG: 削除 on file row
  RAG->>RAG: Confirm dialog
  Operator->>RAG: Confirm 削除する
  RAG->>API: DELETE attachment or standalone file
  API->>DB: Remove metadata and extracted text
  API->>Queue: Enqueue vector cleanup
  Queue->>Vector: Delete chunks
  API-->>RAG: Row removed
```

**Mock:** Delete dialog warns that registration, extracted text, and vectors are permanently removed.

→ Details: [16 § File list](./16-rag-admin-guide.md), [18](./18-webui-mock-inventory-and-flows.md)

## Viewing Range or Condition Change

```mermaid
sequenceDiagram
  actor Operator
  participant WebUI as AISSS WebUI
  participant API as Backend API
  participant DB as PostgreSQL
  participant Queue as Job Queue
  participant Vector as Vector DB

  Operator->>WebUI: Update viewing range or conditions
  WebUI->>API: Submit permission update
  API->>DB: Save new permission state
  API->>DB: Write audit log
  API->>Queue: Enqueue metadata resync job
  Queue->>Vector: Update or recreate affected chunk metadata
  Queue->>DB: Mark RAG sync complete
  API-->>WebUI: Update accepted
```

**Mock:** Case edit (`view-register` **更新する**); standalone range edit in `view-rag-admin` select + **変更を保存**.

→ Details: [18 § Flow B/C](./18-webui-mock-inventory-and-flows.md#operator-flows)

## Case Deletion

```mermaid
sequenceDiagram
  actor Operator
  participant WebUI as AISSS WebUI
  participant API as Backend API
  participant DB as PostgreSQL
  participant Queue as Job Queue
  participant Vector as Vector DB
  participant Storage as Object Storage

  Operator->>WebUI: Delete case
  WebUI->>API: Delete request
  API->>DB: Soft delete case
  API->>DB: Write audit log
  API->>Queue: Enqueue RAG cleanup
  Queue->>Vector: Delete vectors for case UUID
  Queue->>DB: Mark RAG chunks deleted
  API-->>WebUI: Case deleted
  Note over Storage: Original files follow retention policy
```

