# Sequence Diagrams

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

