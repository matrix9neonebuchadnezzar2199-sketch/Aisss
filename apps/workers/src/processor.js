import { downloadObject } from './storage.js'
import { extractText } from './extract.js'
import { detectAttachmentKind } from './attachment-kind.js'

function resolveProcessorDeps (deps = {}) {
  return {
    download: deps.download ?? downloadObject,
    extract: deps.extract ?? extractText
  }
}

export async function claimNextJob (pool, jobType) {
  const { rows } = await pool.query(
    `UPDATE jobs SET status = 'running', updated_at = NOW()
     WHERE id = (
       SELECT id FROM jobs
       WHERE status = 'pending' AND job_type = $1
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`,
    [jobType]
  )
  return rows[0] ?? null
}

// worker クラッシュ等で 'running' のまま残ったジョブを再キューする（永久スタック防止）
export async function requeueStaleRunningJobs (pool, staleMinutes = 10) {
  const { rows } = await pool.query(
    `UPDATE jobs
     SET status = 'pending', updated_at = NOW()
     WHERE status = 'running'
       AND updated_at < NOW() - ($1 * INTERVAL '1 minute')
     RETURNING id, job_type`,
    [staleMinutes]
  )
  return rows
}

export async function markJobFailed (pool, job, error) {
  const message = error instanceof Error ? error.message : String(error ?? 'job failed')
  const retryCount = Number(job.retry_count ?? 0)
  const maxAttempts = Number(job.max_attempts ?? 3)
  const nextRetryCount = retryCount + 1
  const deadLetter = nextRetryCount >= maxAttempts
  await pool.query(
    `UPDATE jobs
     SET status = $2,
         error = $3,
         retry_count = $4,
         dead_lettered_at = CASE WHEN $2 = 'dead_letter' THEN NOW() ELSE dead_lettered_at END,
         updated_at = NOW(),
         completed_at = NOW()
     WHERE id = $1`,
    [job.id, deadLetter ? 'dead_letter' : 'failed', message, nextRetryCount]
  )
  return {
    status: deadLetter ? 'dead_letter' : 'failed',
    error: message,
    retry_count: nextRetryCount
  }
}

async function enqueueEmbeddingJob (pool, payload, caseId, caseDisplayId, attachmentId) {
  await pool.query(
    `INSERT INTO jobs (job_type, status, case_id, case_display_id, attachment_id, payload_json)
     VALUES ('embedding', 'pending', $1, $2, $3, $4::jsonb)`,
    [caseId ?? null, caseDisplayId ?? null, attachmentId ?? null, JSON.stringify(payload)]
  )
}

async function hasCaseViewingRange (pool, caseId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM case_viewing_ranges WHERE case_id = $1 LIMIT 1`,
    [caseId]
  )
  return rows.length > 0
}

async function maybeEnqueueAttachmentEmbedding (pool, attachment) {
  let ragEnabled = attachment.rag_enabled === true
  if (!ragEnabled && attachment.auto_enable_rag_on_extraction === true) {
    if (await hasCaseViewingRange(pool, attachment.case_id)) {
      await pool.query(
        `UPDATE attachments SET rag_enabled = TRUE WHERE id = $1`,
        [attachment.id]
      )
      ragEnabled = true
    }
  }

  if (!ragEnabled) return false

  await enqueueEmbeddingJob(
    pool,
    { source: 'attachment', attachment_id: attachment.id },
    attachment.case_id,
    attachment.display_id,
    attachment.id
  )
  return true
}

export async function processExtractionJob (pool, storage, storageConfig, job, deps = {}) {
  const resolved = resolveProcessorDeps(deps)
  const payload = job.payload_json ?? {}
  const standaloneId = payload.standalone_file_id

  if (standaloneId) {
    return processStandaloneExtraction(pool, storage, storageConfig, job, standaloneId, resolved)
  }

  const attachmentId = job.attachment_id
  if (!attachmentId) throw new Error('Job missing attachment_id')

  const { rows } = await pool.query(
    `SELECT a.*, c.id AS case_id, c.display_id
     FROM attachments a
     JOIN cases c ON c.id = a.case_id
     WHERE a.id = $1 AND c.deleted_at IS NULL`,
    [attachmentId]
  )
  const attachment = rows[0]
  if (!attachment) throw new Error(`Attachment not found: ${attachmentId}`)

  await pool.query(
    `UPDATE attachments SET extraction_status = 'running' WHERE id = $1`,
    [attachmentId]
  )

  const buffer = await resolved.download(storage, storageConfig.bucket, attachment.storage_key)
  const result = await resolved.extract(attachment, buffer)

  if (result.error || !result.text) {
    const message = result.error ?? 'No text extracted'
    await pool.query(
      `UPDATE attachments SET extraction_status = 'failed', extraction_error = $2 WHERE id = $1`,
      [attachmentId, message]
    )
    const failed = await markJobFailed(pool, job, message)
    return { status: failed.status, error: message }
  }

  await pool.query(
    `INSERT INTO extracted_texts (
      case_id, attachment_id, source_type, text, language, extraction_engine, metadata_json
    ) VALUES ($1, $2, $3, $4, 'ja', $5, $6::jsonb)`,
    [
      attachment.case_id,
      attachmentId,
      result.sourceType,
      result.text,
      result.engine,
      JSON.stringify(result.metadata ?? {})
    ]
  )

  await pool.query(
    `UPDATE attachments SET extraction_status = 'succeeded', extraction_error = NULL WHERE id = $1`,
    [attachmentId]
  )
  await pool.query(
    `UPDATE jobs SET status = 'completed', error = NULL, updated_at = NOW(), completed_at = NOW() WHERE id = $1`,
    [job.id]
  )

  await maybeEnqueueAttachmentEmbedding(pool, attachment)

  return { status: 'completed', chars: result.text.length }
}

async function processStandaloneExtraction (pool, storage, storageConfig, job, standaloneId, resolved) {
  const { rows } = await pool.query(
    `SELECT * FROM standalone_files WHERE id = $1 AND deleted_at IS NULL`,
    [standaloneId]
  )
  const file = rows[0]
  if (!file) throw new Error(`Standalone file not found: ${standaloneId}`)

  await pool.query(
    `UPDATE standalone_files SET extraction_status = 'running' WHERE id = $1`,
    [standaloneId]
  )

  const pseudoAttachment = {
    file_name: file.file_name,
    attachment_kind: detectAttachmentKind(file.file_name, file.content_type ?? '')
  }
  const buffer = await resolved.download(storage, storageConfig.bucket, file.storage_key)
  const result = await resolved.extract(pseudoAttachment, buffer)

  if (result.error || !result.text) {
    const message = result.error ?? 'No text extracted'
    await pool.query(
      `UPDATE standalone_files SET extraction_status = 'failed', extraction_error = $2 WHERE id = $1`,
      [standaloneId, message]
    )
    const failed = await markJobFailed(pool, job, message)
    return { status: failed.status, error: message }
  }

  await pool.query(
    `INSERT INTO extracted_texts (
      standalone_file_id, source_type, text, language, extraction_engine, metadata_json
    ) VALUES ($1, $2, $3, 'ja', $4, $5::jsonb)`,
    [
      standaloneId,
      result.sourceType,
      result.text,
      result.engine,
      JSON.stringify(result.metadata ?? {})
    ]
  )

  await pool.query(
    `UPDATE standalone_files SET extraction_status = 'succeeded', extraction_error = NULL WHERE id = $1`,
    [standaloneId]
  )
  await pool.query(
    `UPDATE jobs SET status = 'completed', error = NULL, updated_at = NOW(), completed_at = NOW() WHERE id = $1`,
    [job.id]
  )

  if (file.rag_enabled) {
    await enqueueEmbeddingJob(pool, { source: 'standalone', standalone_file_id: standaloneId })
  }

  return { status: 'completed', chars: result.text.length }
}
