import { downloadObject } from './storage.js'
import { extractText } from './extract.js'

export async function claimNextJob (pool) {
  const { rows } = await pool.query(
    `UPDATE jobs SET status = 'running', updated_at = NOW()
     WHERE id = (
       SELECT id FROM jobs
       WHERE status = 'pending' AND job_type = 'extraction'
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`
  )
  return rows[0] ?? null
}

export async function processJob (pool, storage, storageConfig, job) {
  const attachmentId = job.attachment_id
  if (!attachmentId) {
    throw new Error('Job missing attachment_id')
  }

  const { rows } = await pool.query(
    `SELECT a.*, c.id AS case_id
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

  const buffer = await downloadObject(
    storage,
    storageConfig.bucket,
    attachment.storage_key
  )
  const result = await extractText(attachment, buffer)

  if (result.error || !result.text) {
    const message = result.error ?? 'No text extracted'
    await pool.query(
      `UPDATE attachments
       SET extraction_status = 'failed', extraction_error = $2
       WHERE id = $1`,
      [attachmentId, message]
    )
    await pool.query(
      `UPDATE jobs SET status = 'failed', error = $2, updated_at = NOW(), completed_at = NOW()
       WHERE id = $1`,
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
    `UPDATE jobs SET status = 'completed', error = NULL, updated_at = NOW(), completed_at = NOW()
     WHERE id = $1`,
    [job.id]
  )

  return { status: 'completed', chars: result.text.length }
}
