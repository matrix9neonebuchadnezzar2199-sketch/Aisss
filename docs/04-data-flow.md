# Data Flow

## High-Level Flow

```mermaid
flowchart LR
  inputFiles["Office PDF Image Audio Text"] --> webui["Aisss WebUI"]
  webui --> backend["Backend API"]
  backend --> postgres["PostgreSQL Metadata"]
  backend --> storage["Object Storage Originals"]
  backend --> queue["Job Queue"]
  queue --> extraction["Extraction OCR ASR"]
  extraction --> extractedText["Extracted Text"]
  extractedText --> postgres
  postgres --> chunking["Chunking and Metadata Build"]
  chunking --> vectorDb["Vector DB"]
  userQuestion["User Question"] --> dify["Dify Workflow"]
  dify --> searchMw["Permissioned Search Middleware"]
  searchMw --> postgres
  searchMw --> vectorDb
  searchMw --> safeContext["Safe Context"]
  safeContext --> dify
  dify --> ollama["Ollama"]
  ollama --> answer["Answer and Citations"]
```

## Record Data

```mermaid
flowchart TD
  caseForm["Case Form"] --> validation["API Validation"]
  excelImport["Excel Import"] --> validation
  validation --> masterLookup["Master Lookup"]
  masterLookup --> caseRecord["Case Record"]
  caseRecord --> bodySections["Body Sections"]
  caseRecord --> conditions["Selected Conditions"]
  caseRecord --> viewingRanges["Viewing Ranges"]
  caseRecord --> audit["Audit Log"]
  bodySections --> ragBodyText["Case Body Text for RAG"]
  conditions --> ragMetadata["RAG Metadata"]
  viewingRanges --> ragMetadata
```

## Attachment Data

```mermaid
flowchart TD
  upload["Attachment Upload"] --> fileValidation["File Validation"]
  fileValidation --> objectStorage["Object Storage"]
  fileValidation --> attachmentMeta["Attachment Metadata"]
  attachmentMeta --> postgres["PostgreSQL"]
  objectStorage --> parserRouter["Parser Router"]
  parserRouter --> officeParser["Office Parser"]
  parserRouter --> pdfParser["PDF Parser"]
  parserRouter --> ocrEngine["OCR Engine"]
  parserRouter --> asrEngine["ASR Engine"]
  officeParser --> extracted["Extracted Text"]
  pdfParser --> extracted
  ocrEngine --> extracted
  asrEngine --> extracted
  extracted --> postgres
```

## Permissioned RAG Data

```mermaid
flowchart TD
  extractedText["Extracted Text"] --> chunkBuilder["Chunk Builder"]
  caseMetadata["Case Metadata"] --> chunkBuilder
  aclData["Viewing Range and Conditions"] --> chunkBuilder
  chunkBuilder --> chunks["RAG Chunks"]
  chunks --> embeddings["Embeddings"]
  embeddings --> vectorDb["Vector DB"]
  userIdentity["Trusted User Identity"] --> policyCalc["Policy Calculation"]
  policyCalc --> allowedScope["Allowed Case Scope"]
  allowedScope --> vectorSearch["Filtered Vector Search"]
  vectorDb --> vectorSearch
  vectorSearch --> finalCheck["PostgreSQL Final Permission Check"]
  finalCheck --> safeContext["Safe Context for Dify"]
```

## Data Classification

| Data | Primary Store | Secondary Store | Notes |
|---|---|---|---|
| Case metadata | PostgreSQL | Vector metadata | PostgreSQL is authoritative. |
| Body sections | PostgreSQL | RAG chunks | Stored separately, rendered together. |
| Original files | Object storage | None | Download through API only. |
| Extracted text | PostgreSQL | RAG chunks | Rebuildable from original files when parser is stable. |
| Embeddings | Vector DB | None | Rebuildable. |
| Dify answer history | Dify or Aisss audit | Audit log summary | Avoid storing restricted text where not governed. |
| Audit log | PostgreSQL | Backup | Protected operator access. |

## Data Freshness Rules

| Change | Required Data Flow |
|---|---|
| Case metadata update | Update PostgreSQL, rebuild affected RAG metadata. |
| Body update | Recreate body extracted text and chunks. |
| Attachment upload | Store original, extract text, chunk, embed. |
| Attachment delete | Remove extracted text and vector chunks. |
| Viewing range change | Update PostgreSQL, update vector metadata, clear permission caches. |
| Condition change | Update PostgreSQL, update vector metadata, clear permission caches. |
| Master label change | Update display labels and optionally refresh RAG metadata. |
| Case delete | Soft delete, remove vectors, retain originals according to retention policy. |

## Dify Direct Data

```mermaid
flowchart LR
  difyUpload["Dify Direct Upload"] --> difyKnowledge["Dify Knowledge"]
  difyUpload --> shadowRegistration["Aisss Shadow Registration"]
  shadowRegistration --> postgres["PostgreSQL Source Metadata"]
  postgres --> permissionPolicy["Permission Policy"]
  difyKnowledge --> difyWorkflow["Dify Workflow"]
  permissionPolicy --> searchMw["Permissioned Middleware"]
  searchMw --> difyWorkflow
```

Dify direct documents must not become part of sensitive production RAG unless Aisss has metadata that defines ownership, viewing range, and handling conditions.
