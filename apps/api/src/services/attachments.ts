import { createHash, randomUUID } from 'node:crypto'
import type { S3Client } from '@aws-sdk/client-s3'
import type pg from 'pg'
import { detectAttachmentKind } from '../lib/attachment-kind.js'
import { AppError } from '../lib/errors.js'
import type { AuthUser } from '../types/auth.js'
import type { ObjectStorageSettings } from '../settings.js'
import { getCaseById } from './cases.js'
import { putObject } from './storage.js'
import { writeAuditLog } from './audit.js'

function buildStorageKey (caseId: string, attachmentId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-()]+/g, '_')
  return `cases/${caseId}/${attachmentId}/${safeName}`
}

async function enqueueExtractionJob (
  pool: pg.Pool,
  attachmentId: string,
  caseId: string,
  displayId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO jobs (job_type, status, case_id, case_display_id, attachment_id, payload_json)
     VALUES ('extraction', 'pending', $1, $2, $3, $4::jsonb)`,
    [caseId, displayId, attachmentId, JSON.stringify({ attachment_id: attachmentId })]
  )
}

export async function uploadAttachment (
  pool: pg.Pool,
  storage: S3Client,
  storageConfig: ObjectStorageSettings,
  user: AuthUser,
  caseId: string,
  fileName: string,
  contentType: string,
  buffer: Buffer,
  autoEnableRagOnExtraction = false
) {
  const caseRow = await getCaseById(pool, user, caseId)
  const attachmentId = randomUUID()
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const kind = detectAttachmentKind(fileName, contentType)
  const storageKey = buildStorageKey(caseId, attachmentId, fileName)

  await putObject(storage, storageConfig.bucket, storageKey, buffer, contentType || 'application/octet-stream')

  const { rows } = await pool.query(
    `INSERT INTO attachments (
      id, case_id, file_name, storage_key, content_type, file_size, sha256,
      attachment_kind, uploaded_by, extraction_status, auto_enable_rag_on_extraction
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10)
    RETURNING id, file_name, extraction_status, uploaded_at, attachment_kind,
      rag_enabled, auto_enable_rag_on_extraction`,
    [
      attachmentId,
      caseId,
      fileName,
      storageKey,
      contentType || 'application/octet-stream',
      buffer.length,
      sha256,
      kind,
      user.id,
      autoEnableRagOnExtraction
    ]
  )

  await enqueueExtractionJob(pool, attachmentId, caseId, caseRow.display_id as string)
  await writeAuditLog(pool, {
    userId: user.id,
    action: 'attachment.upload',
    resourceType: 'attachment',
    resourceId: attachmentId,
    caseDisplayId: caseRow.display_id as string,
    details: { file_name: fileName, sha256 }
  })

  return rows[0]
}

export async function listAttachments (
  pool: pg.Pool,
  user: AuthUser,
  caseId: string
) {
  await getCaseById(pool, user, caseId)
  const { rows } = await pool.query(
    `SELECT id, file_name, content_type, file_size, attachment_kind,
            extraction_status, extraction_error, uploaded_at,
            rag_enabled, auto_enable_rag_on_extraction
     FROM attachments WHERE case_id = $1 ORDER BY uploaded_at DESC`,
    [caseId]
  )
  return rows
}

export async function getAttachmentForUser (
  pool: pg.Pool,
  user: AuthUser,
  attachmentId: string
) {
  const { rows } = await pool.query(
    `SELECT a.*, c.display_id AS case_display_id
     FROM attachments a
     JOIN cases c ON c.id = a.case_id
     WHERE a.id = $1 AND c.deleted_at IS NULL`,
    [attachmentId]
  )
  const row = rows[0]
  if (!row) throw new AppError('not_found', 'Attachment not found.', 404)
  await getCaseById(pool, user, row.case_id as string)
  return row
}

export async function getExtractedText (
  pool: pg.Pool,
  user: AuthUser,
  attachmentId: string
) {
  await getAttachmentForUser(pool, user, attachmentId)
  const { rows } = await pool.query(
    `SELECT id, source_type, text, language, extraction_engine, metadata_json, created_at
     FROM extracted_texts
     WHERE attachment_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [attachmentId]
  )
  if (!rows[0]) {
    return { attachment_id: attachmentId, text: null, status: 'not_ready' }
  }
  return { attachment_id: attachmentId, ...rows[0] }
}

export async function retryExtraction (
  pool: pg.Pool,
  user: AuthUser,
  attachmentId: string
) {
  const attachment = await getAttachmentForUser(pool, user, attachmentId)
  await pool.query(
    `UPDATE attachments SET extraction_status = 'pending', extraction_error = NULL
     WHERE id = $1`,
    [attachmentId]
  )
  await enqueueExtractionJob(
    pool,
    attachmentId,
    attachment.case_id as string,
    attachment.case_display_id as string
  )
  await writeAuditLog(pool, {
    userId: user.id,
    action: 'attachment.retry_extraction',
    resourceType: 'attachment',
    resourceId: attachmentId,
    caseDisplayId: attachment.case_display_id as string
  })
  return { id: attachmentId, extraction_status: 'pending' }
}

export async function updateAutoEnableRagOnExtraction (
  pool: pg.Pool,
  user: AuthUser,
  attachmentId: string,
  enabled: boolean
) {
  await getAttachmentForUser(pool, user, attachmentId)
  const { rows } = await pool.query(
    `UPDATE attachments
     SET auto_enable_rag_on_extraction = $2
     WHERE id = $1
     RETURNING id, auto_enable_rag_on_extraction`,
    [attachmentId, enabled]
  )
  await writeAuditLog(pool, {
    userId: user.id,
    action: 'attachment.auto_rag.update',
    resourceType: 'attachment',
    resourceId: attachmentId,
    details: { auto_enable_rag_on_extraction: enabled }
  })
  return rows[0]
}
