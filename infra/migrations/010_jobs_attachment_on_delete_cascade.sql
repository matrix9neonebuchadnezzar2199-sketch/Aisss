-- RAG 管理から添付削除時、関連ジョブ行が FK でブロックされないようにする
ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_attachment_id_fkey;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_attachment_id_fkey
  FOREIGN KEY (attachment_id) REFERENCES attachments (id) ON DELETE CASCADE;
