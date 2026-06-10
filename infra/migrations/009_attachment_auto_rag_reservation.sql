-- M9: allow users to request RAG enablement after extraction succeeds.

ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS auto_enable_rag_on_extraction BOOLEAN NOT NULL DEFAULT FALSE;
