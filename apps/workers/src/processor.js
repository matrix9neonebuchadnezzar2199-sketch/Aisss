import { downloadObject } from './storage.js'
import { extractText } from './extract.js'

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

async function enqueueEmbeddingJob (pool, payload, caseId, caseDisplayId, attachmentId) {
  await pool.query(
    `INSERT INTO jobs (job_type, status, case_id, case_display_id, attachment_id, payload_json)
     VALUES ('embedding', 'pending', $1, $2, $3, $4::jsonb)`,
    [caseId ?? null, caseDisplayId ?? null, attachmentId ?? null, JSON.stringify(payload)]
  )
}

export async function processExtractionJob (pool, storage, storageConfig, job) {
  const payload = job.payload_json ?? {}
  const standaloneId = payload.standalone_file_id

  if (standaloneId) {
    return processStandaloneExtraction(pool, storage, storageConfig, job, standaloneId)
  }

  const attachmentId = job.attachment_id
  if (!attachmentId) throw new Error('Job missing attachment_id')

  const { rows } = await pool.query(
    `SELECT a.*, c.id AS case_id, c.display_id
     FROM attachments a
     JOIN cases c ON c.id = a.case_id
     WHERE a.id = $1`,
    [attachmentId]
  )
  const attachment = rows[0]
  if (!attachment) throw new Error(`Attachment not found: ${attachmentId}`)

  await pool.query(
    `UPDATE attachments SET extraction_status = 'running' WHERE id = $1`,
    [attachmentId]
  )

  const buffer = await downloadObject(storage, storageConfig.bucket, attachment.storage_key)
  const result = await extractText(attachment, buffer)

  if (result.error || !result.text) {
    const message = result.error ?? 'No text extracted'
    await pool.query(
      `UPDATE attachments SET extraction_status = 'failed', extraction_error = $2 WHERE id = $1`,
      [attachmentId, message]
    )
    await pool.query(
      `UPDATE jobs SET status = 'failed', error = $2, updated_at = NOW(), completed_at = NOW() WHERE id = $1`,
      [job.id, message]
    )
    return { status: 'failed', error: message }
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

  if (attachment.rag_enabled) {
    await enqueueEmbeddingJob(
      pool,
      { source: 'attachment', attachment_id: attachmentId },
      attachment.case_id,
      attachment.display_id,
      attachmentId
    )
  }

  return { status: 'completed', chars: result.text.length }
}

async function processStandaloneExtraction (pool, storage, storageConfig, job, standaloneId) {
  const { rows } = await pool.query(
    `SELECT * FROM standalone_files WHERE id = $1`,
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
    attachment_kind: 'other'
  }
  const buffer = await downloadObject(storage, storageConfig.bucket, file.storage_key)
  const result = await extractText(pseudoAttachment, buffer)

  if (result.error || !result.text) {
    const message = result.error ?? 'No text extracted'
    await pool.query(
      `UPDATE standalone_files SET extraction_status = 'failed', extraction_error = $2 WHERE id = $1`,
      [standaloneId, message]
    )
    await pool.query(
      `UPDATE jobs SET status = 'failed', error = $2, updated_at = NOW(), completed_at = NOW() WHERE id = $1`,
      [job.id, message]
    )
    return { status: 'failed', error: message }
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
