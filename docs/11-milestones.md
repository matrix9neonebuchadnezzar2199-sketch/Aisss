# Milestones

## Milestone 0: Design Baseline

Goal: Make implementation decisions explicit before coding.

Deliverables:

- Requirements document.
- Overall architecture.
- Data model draft.
- RAG permission design.
- Ingestion design.
- WebUI and API boundary.
- ADRs.

Done when:

- Case fields are represented in the data model.
- RAG permission approach is approved.
- MVP scope is understood by implementers.

## Milestone 1: Repository and Development Environment

Goal: Prepare a runnable project skeleton.

Deliverables:

- Repository structure.
- Backend skeleton.
- WebUI skeleton.
- Database migration setup.
- Local Docker Compose for PostgreSQL, object storage, queue, vector DB, Dify, and Ollama where practical.
- `.env.example`.
- Basic CI for lint and tests.

Done when:

- A developer can start the local stack from documented commands.
- Empty WebUI and API health checks run.
- Initial migrations apply successfully.

## Milestone 2: Case Management MVP

Goal: Register, edit, view, and search cases without AI.

Deliverables:

- Case create/edit/detail screens.
- Master list management.
- User/group/viewing range basics.
- Case metadata search.
- Audit logs for case and master changes.

Done when:

- Required case fields can be stored and edited.
- Viewing ranges prevent unauthorized case detail access.
- Operators can add master values from WebUI.

## Milestone 3: Attachment and Extraction MVP

Goal: Attach files and extract text asynchronously.

Deliverables:

- Attachment upload/download with permission checks.
- Object storage integration.
- Extraction worker for Office and PDF.
- OCR path for image/scanned PDF.
- ASR path for audio or manual transcript.
- Extraction status and retry UI.

Done when:

- Original files are stored outside PostgreSQL.
- Extracted text is linked to case and attachment.
- Failed extraction is visible and retryable.

## Milestone 4: Excel Import

Goal: Support bulk registration using controlled templates.

Deliverables:

- Excel template.
- Import preview.
- Validation rules.
- Confirmed import.
- Row-level error reporting.
- Import audit logs.

Done when:

- Valid rows create or update cases.
- Invalid rows are rejected with actionable messages.
- Master strictness rules are enforced.

## Milestone 5: Permissioned RAG MVP

Goal: Enable AI question answering without leaking restricted cases.

Deliverables:

- Chunking and embedding jobs.
- Vector database integration.
- Permissioned search middleware.
- Dify workflow integration.
- Ollama model integration.
- Citation display.
- Handling-condition output restrictions.

Done when:

- Unauthorized users cannot retrieve restricted chunks.
- `照会禁止` cases are excluded from AI answers.
- AI answers cite only allowed cases.
- Permission changes update RAG behavior.

## Milestone 6: Operational Hardening

Goal: Prepare for real multi-user operation.

Deliverables:

- Full audit log views.
- Backup and restore procedures.
- Permission regression tests.
- Job retry and dead-letter handling.
- Admin dashboards.
- Security review of storage and RAG boundaries.

Done when:

- Operators can monitor failed jobs.
- Backup restore is tested.
- Permission tests cover major access paths.

## Milestone 7: Production Pilot

Goal: Pilot with limited users and real operational documents.

Deliverables:

- Pilot user group.
- Seeded master data.
- Initial Excel templates.
- Operational runbook.
- Feedback process.
- Known limitations list.

Done when:

- Pilot users can complete core workflows.
- Permission incidents are not observed in test cases.
- Feedback is triaged into post-MVP backlog.

## Post-MVP Ideas

- Native image similarity search.
- Advanced ranking using reliability, accuracy, and rank.
- Dify direct knowledge shadow-sync automation.
- Case relation graph.
- Retention expiration workflows.
- Redaction workflow for external sharing.
- Analytics for search and AI usage.
