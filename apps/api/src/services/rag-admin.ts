import { createHash, randomUUID } from 'node:crypto'
import type { S3Client } from '@aws-sdk/client-s3'
import type pg from 'pg'
import { AppError } from '../lib/errors.js'
import type { AuthUser } from '../types/auth.js'
import type { ObjectStorageSettings } from '../settings.js'
import { getCaseById } from './cases.js'
import { isAdmin } from './permissions.js'
import { deleteObject, putObject } from './storage.js'
import { writeAuditLog } from './audit.js'
import { deletePoints } from './qdrant.js'
import type { Settings } from '../settings.js'
import { getRagStorageBreakdown } from './rag-storage-breakdown.js'
import { deleteJobsForStandaloneFile } from './job-cleanup.js'

function requireOperator (user: AuthUser) {
  if (!isAdmin(user) && user.role !== 'operator') {
    throw new AppError('permission_denied', 'Operator or admin role required.', 403)
  }
}

async function enqueueEmbeddingJob (
  pool: pg.Pool,
  payload: Record<string, unknown>,
  caseId?: string | null,
  caseDisplayId?: string | null,
  attachmentId?: string | null
) {
  await pool.query(
    `INSERT INTO jobs (job_type, status, case_id, case_display_id, attachment_id, payload_json)
     VALUES ('embedding', 'pending', $1, $2, $3, $4::jsonb)`,
    [caseId ?? null, caseDisplayId ?? null, attachmentId ?? null, JSON.stringify(payload)]
  )
}

export async function getRagStatus (pool: pg.Pool) {
  const [chunks, pending, failed, synced, attachCandidates, standaloneCandidates, autoReserved] = await Promise.all([
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM rag_chunks`),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM jobs WHERE job_type = 'embedding' AND status = 'pending'`
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM jobs WHERE job_type IN ('embedding','extraction') AND status = 'failed'`
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM rag_sync_states WHERE sync_status = 'synced'`
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM attachments
       WHERE rag_enabled = FALSE
         AND auto_enable_rag_on_extraction = FALSE
         AND extraction_status = 'succeeded'`
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM standalone_files
       WHERE deleted_at IS NULL
         AND rag_enabled = FALSE
         AND extraction_status = 'succeeded'`
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM attachments
       WHERE rag_enabled = FALSE
         AND auto_enable_rag_on_extraction = TRUE
         AND extraction_status IN ('pending', 'running', 'succeeded')`
    )
  ])
  const notEnabledCandidates =
    Number(attachCandidates.rows[0]?.count ?? 0) + Number(standaloneCandidates.rows[0]?.count ?? 0)
  const storage_breakdown = await getRagStorageBreakdown(pool)
  return {
    chunk_count: Number(chunks.rows[0]?.count ?? 0),
    embedding_pending: Number(pending.rows[0]?.count ?? 0),
    pipeline_failed: Number(failed.rows[0]?.count ?? 0),
    vectors_synced: Number(synced.rows[0]?.count ?? 0),
    not_enabled_candidates: notEnabledCandidates,
    auto_enable_reserved: Number(autoReserved.rows[0]?.count ?? 0),
    storage_breakdown
  }
}

type RagFileRow = {
  id: string
  source_kind: 'case_attachment' | 'standalone'
  title: string
  file_name: string
  case_id: string | null
  case_display_id: string | null
  viewing_range_ids: string[]
  viewing_range_labels: string[]
  editable_viewing_range: boolean
  pipeline_status: string
  rag_enabled: boolean
  auto_enable_rag_on_extraction: boolean
  extraction_status: string
  rag_visibility_state: RagVisibilityState
  rag_visibility_label: string
  is_knowledge_candidate: boolean
  tags?: string[]
  genre?: string
  registered_at?: string
}

async function mapViewingLabels (
  pool: pg.Pool,
  ids: string[]
): Promise<string[]> {
  if (ids.length === 0) return []
  const { rows } = await pool.query<{ name: string }>(
    `SELECT name FROM viewing_ranges WHERE id = ANY($1::uuid[]) ORDER BY sort_order`,
    [ids]
  )
  return rows.map((r) => r.name)
}

function pipelineStatus (extraction: string, chunkCount: number, syncedCount: number): string {
  if (extraction === 'failed') return 'extraction_failed'
  if (extraction === 'pending' || extraction === 'running') return 'extracting'
  if (chunkCount === 0) return 'embedding_pending'
  if (syncedCount < chunkCount) return 'embedding'
  return 'ready'
}

export type RagVisibilityState =
  | 'rag_enabled'
  | 'auto_enable_reserved'
  | 'knowledge_candidate'
  | 'extraction_failed'
  | 'extracting'
  | 'rag_disabled'

export function resolveRagVisibilityState (input: {
  rag_enabled: boolean
  auto_enable_rag_on_extraction: boolean
  extraction_status: string
}): {
  state: RagVisibilityState
  label: string
  is_knowledge_candidate: boolean
} {
  if (input.rag_enabled) {
    return { state: 'rag_enabled', label: 'RAG有効', is_knowledge_candidate: false }
  }
  if (input.extraction_status === 'failed') {
    return { state: 'extraction_failed', label: '抽出失敗', is_knowledge_candidate: false }
  }
  if (input.extraction_status === 'pending' || input.extraction_status === 'running') {
    return { state: 'extracting', label: '抽出中', is_knowledge_candidate: false }
  }
  if (input.auto_enable_rag_on_extraction) {
    return { state: 'auto_enable_reserved', label: '自動ON予約', is_knowledge_candidate: false }
  }
  // worker は抽出成功を extraction_status='succeeded' で記録する（'completed' は jobs.status 側の値）
  if (input.extraction_status === 'succeeded') {
    return { state: 'knowledge_candidate', label: '未ナレッジ化候補', is_knowledge_candidate: true }
  }
  return { state: 'rag_disabled', label: 'RAG無効', is_knowledge_candidate: false }
}

function parseDateBound (value: string | undefined, endOfDay: boolean): Date | null {
  if (!value?.trim()) return null
  const parts = value.trim().split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null
  const [year, month, day] = parts
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0)
}

function withinDateRange (
  registeredAt: Date,
  dateFrom: Date | null,
  dateTo: Date | null
): boolean {
  if (dateFrom && registeredAt < dateFrom) return false
  if (dateTo && registeredAt > dateTo) return false
  return true
}

export async function listRagFiles (
  pool: pg.Pool,
  query: {
    q?: string
    viewing_range_id?: string
    tag?: string
    date_from?: string
    date_to?: string
    knowledge_candidates_only?: boolean
  }
): Promise<{ items: RagFileRow[] }> {
  const items: RagFileRow[] = []
  const dateFrom = parseDateBound(query.date_from, false)
  const dateTo = parseDateBound(query.date_to, true)

  const attachSql = `
    SELECT a.id, a.file_name, a.rag_enabled, a.auto_enable_rag_on_extraction, a.extraction_status,
           a.uploaded_at,
           c.id AS case_id, c.display_id AS case_display_id, c.title AS case_title,
           (SELECT COUNT(*)::int FROM rag_chunks rc WHERE rc.attachment_id = a.id) AS chunk_count,
           (SELECT COUNT(*)::int FROM rag_sync_states rs
            JOIN rag_chunks rc ON rc.id = rs.chunk_id
            WHERE rc.attachment_id = a.id AND rs.sync_status = 'synced') AS synced_count
    FROM attachments a
    JOIN cases c ON c.id = a.case_id
    WHERE c.deleted_at IS NULL
  `
  const { rows: attachments } = await pool.query(attachSql)

  for (const row of attachments) {
    const { rows: vr } = await pool.query<{ viewing_range_id: string }>(
      `SELECT viewing_range_id FROM case_viewing_ranges WHERE case_id = $1`,
      [row.case_id]
    )
    const viewingRangeIds = vr.map((r) => r.viewing_range_id)
    if (query.viewing_range_id && !viewingRangeIds.includes(query.viewing_range_id)) continue
    const title = `${row.case_title} / ${row.file_name}`
    if (query.q && !title.toLowerCase().includes(query.q.toLowerCase())) continue
    const uploadedAt = new Date(row.uploaded_at as string | Date)
    if (!withinDateRange(uploadedAt, dateFrom, dateTo)) continue

    const visibility = resolveRagVisibilityState({
      rag_enabled: row.rag_enabled,
      auto_enable_rag_on_extraction: row.auto_enable_rag_on_extraction === true,
      extraction_status: row.extraction_status
    })
    items.push({
      id: row.id,
      source_kind: 'case_attachment',
      title: row.case_title,
      file_name: row.file_name,
      case_id: row.case_id,
      case_display_id: row.case_display_id,
      viewing_range_ids: viewingRangeIds,
      viewing_range_labels: await mapViewingLabels(pool, viewingRangeIds),
      editable_viewing_range: false,
      pipeline_status: pipelineStatus(
        row.extraction_status,
        row.chunk_count,
        row.synced_count
      ),
      rag_enabled: row.rag_enabled,
      auto_enable_rag_on_extraction: row.auto_enable_rag_on_extraction === true,
      extraction_status: row.extraction_status,
      rag_visibility_state: visibility.state,
      rag_visibility_label: visibility.label,
      is_knowledge_candidate: visibility.is_knowledge_candidate,
      registered_at: uploadedAt.toISOString(),
      genre: 'case'
    })
  }

  const standaloneSql = `
    SELECT sf.*,
           (SELECT array_agg(tag) FROM standalone_file_tags t WHERE t.standalone_file_id = sf.id) AS tags,
           (SELECT COUNT(*)::int FROM rag_chunks rc WHERE rc.standalone_file_id = sf.id) AS chunk_count,
           (SELECT COUNT(*)::int FROM rag_sync_states rs
            JOIN rag_chunks rc ON rc.id = rs.chunk_id
            WHERE rc.standalone_file_id = sf.id AND rs.sync_status = 'synced') AS synced_count
    FROM standalone_files sf
    WHERE sf.deleted_at IS NULL
  `
  const { rows: standalones } = await pool.query(standaloneSql)

  for (const row of standalones) {
    const { rows: vr } = await pool.query<{ viewing_range_id: string }>(
      `SELECT viewing_range_id FROM standalone_file_viewing_ranges WHERE standalone_file_id = $1`,
      [row.id]
    )
    const viewingRangeIds = vr.map((r) => r.viewing_range_id)
    if (query.viewing_range_id && !viewingRangeIds.includes(query.viewing_range_id)) continue
    if (query.q && !row.title.toLowerCase().includes(query.q.toLowerCase())) continue
    if (query.tag && !(row.tags ?? []).includes(query.tag)) continue
    const registeredAt = new Date(row.registered_at as string | Date)
    if (!withinDateRange(registeredAt, dateFrom, dateTo)) continue

    const visibility = resolveRagVisibilityState({
      rag_enabled: row.rag_enabled,
      auto_enable_rag_on_extraction: false,
      extraction_status: row.extraction_status
    })
    items.push({
      id: row.id,
      source_kind: 'standalone',
      title: row.title,
      file_name: row.file_name,
      case_id: null,
      case_display_id: null,
      viewing_range_ids: viewingRangeIds,
      viewing_range_labels: await mapViewingLabels(pool, viewingRangeIds),
      editable_viewing_range: true,
      pipeline_status: pipelineStatus(
        row.extraction_status,
        row.chunk_count,
        row.synced_count
      ),
      rag_enabled: row.rag_enabled,
      auto_enable_rag_on_extraction: false,
      extraction_status: row.extraction_status,
      rag_visibility_state: visibility.state,
      rag_visibility_label: visibility.label,
      is_knowledge_candidate: visibility.is_knowledge_candidate,
      tags: row.tags ?? [],
      registered_at: registeredAt.toISOString(),
      genre: 'standalone_reference'
    })
  }

  const filtered = query.knowledge_candidates_only
    ? items.filter((item) => item.is_knowledge_candidate)
    : items
  return { items: filtered }
}

export async function getRagTree (pool: pg.Pool) {
  const { items } = await listRagFiles(pool, {})
  const genres: Record<string, { id: string; label: string; groups: Record<string, unknown> }> = {
    case: { id: 'case', label: 'ケース（事象）', groups: {} },
    standalone: { id: 'standalone', label: '単独ファイル（参照資料）', groups: {} }
  }

  for (const item of items) {
    const genreKey = item.source_kind === 'standalone' ? 'standalone' : 'case'
    const groupName = item.title
    const groups = genres[genreKey].groups as Record<string, {
      id: string
      label: string
      files: Array<{
        id: string
        label: string
        rag_enabled: boolean
        source_kind: 'case_attachment' | 'standalone'
        extraction_status: string
        auto_enable_rag_on_extraction: boolean
        rag_visibility_state: RagVisibilityState
        rag_visibility_label: string
      }>
    }>
    if (!groups[groupName]) {
      groups[groupName] = { id: groupName, label: groupName, files: [] }
    }
    groups[groupName].files.push({
      id: item.id,
      label: item.file_name,
      rag_enabled: item.rag_enabled,
      source_kind: item.source_kind,
      extraction_status: item.extraction_status,
      auto_enable_rag_on_extraction: item.auto_enable_rag_on_extraction,
      rag_visibility_state: item.rag_visibility_state,
      rag_visibility_label: item.rag_visibility_label
    })
  }

  return {
    genres: Object.values(genres).map((g) => ({
      ...g,
      groups: Object.values(g.groups as Record<string, unknown>)
    }))
  }
}

export async function setRagEnabled (
  pool: pg.Pool,
  settings: Settings,
  user: AuthUser,
  fileId: string,
  enabled: boolean,
  sourceKind?: 'case_attachment' | 'standalone'
) {
  requireOperator(user)

  if (sourceKind === 'standalone' || !sourceKind) {
    const { rows } = await pool.query(
      `UPDATE standalone_files SET rag_enabled = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [fileId, enabled]
    )
    if (rows[0]) {
      await writeAuditLog(pool, {
        userId: user.id,
        action: 'rag.enable',
        resourceType: 'standalone_file',
        resourceId: fileId,
        details: { enabled }
      })
      if (enabled) {
        await enqueueEmbeddingJob(pool, { source: 'standalone', standalone_file_id: fileId })
      } else {
        await syncDisableVectors(pool, settings, fileId, 'standalone')
      }
      return { id: fileId, rag_enabled: enabled, source_kind: 'standalone' }
    }
  }

  const { rows } = await pool.query(
    `UPDATE attachments SET rag_enabled = $2 WHERE id = $1 RETURNING id, case_id`,
    [fileId, enabled]
  )
  if (!rows[0]) throw new AppError('not_found', 'File not found.', 404)

  const caseRow = await getCaseById(pool, user, rows[0].case_id as string)
  await writeAuditLog(pool, {
    userId: user.id,
    action: 'rag.enable',
    resourceType: 'attachment',
    resourceId: fileId,
    caseDisplayId: caseRow.display_id as string,
    details: { enabled }
  })

  if (enabled) {
    await enqueueEmbeddingJob(pool, {
      source: 'attachment',
      attachment_id: fileId
    }, caseRow.id as string, caseRow.display_id as string, fileId)
  } else {
    await syncDisableVectors(pool, settings, fileId, 'attachment')
  }

  return { id: fileId, rag_enabled: enabled, source_kind: 'case_attachment' }
}

async function deleteQdrantPointsForSource (
  pool: pg.Pool,
  settings: Settings,
  fileId: string,
  kind: 'attachment' | 'standalone'
) {
  const col = kind === 'attachment' ? 'attachment_id' : 'standalone_file_id'
  const { rows } = await pool.query<{ vector_point_id: string }>(
    `SELECT rs.vector_point_id
     FROM rag_sync_states rs
     JOIN rag_chunks rc ON rc.id = rs.chunk_id
     WHERE rc.${col} = $1`,
    [fileId]
  )
  const ids = rows.map((r) => r.vector_point_id)
  if (ids.length === 0) return
  try {
    await deletePoints(settings.vectorDbUrl, settings.vectorCollection, ids)
  } catch {
    // vectors may already be gone
  }
}

async function syncDisableVectors (
  pool: pg.Pool,
  settings: Settings,
  fileId: string,
  kind: 'attachment' | 'standalone'
) {
  await deleteQdrantPointsForSource(pool, settings, fileId, kind)
}

/** Qdrant ベクタ・チャンク・抽出テキストを削除する（ファイル本体削除の前処理） */
export async function purgeRagDataForSource (
  pool: pg.Pool,
  settings: Settings,
  fileId: string,
  kind: 'attachment' | 'standalone'
) {
  await deleteQdrantPointsForSource(pool, settings, fileId, kind)
  const col = kind === 'attachment' ? 'attachment_id' : 'standalone_file_id'
  await pool.query(`DELETE FROM rag_chunks WHERE ${col} = $1`, [fileId])
  if (kind === 'standalone') {
    await pool.query(`DELETE FROM extracted_texts WHERE standalone_file_id = $1`, [fileId])
  }
}

export async function registerStandaloneFile (
  pool: pg.Pool,
  storage: S3Client,
  storageConfig: ObjectStorageSettings,
  user: AuthUser,
  input: {
    title: string
    viewing_range_ids: string[]
    tags: string[]
    fileName: string
    contentType: string
    buffer: Buffer
  }
) {
  requireOperator(user)
  if (!input.title.trim()) {
    throw new AppError('validation_error', 'title is required.', 400)
  }
  if (input.viewing_range_ids.length === 0) {
    throw new AppError('validation_error', 'viewing_range_ids is required.', 400)
  }

  const fileId = randomUUID()
  const sha256 = createHash('sha256').update(input.buffer).digest('hex')
  const storageKey = `standalone/${fileId}/${input.fileName.replace(/[^\w.\-()]+/g, '_')}`
  await putObject(storage, storageConfig.bucket, storageKey, input.buffer, input.contentType)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO standalone_files (
        id, title, file_name, storage_key, content_type, file_size, sha256, registered_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        fileId,
        input.title.trim(),
        input.fileName,
        storageKey,
        input.contentType,
        input.buffer.length,
        sha256,
        user.id
      ]
    )
    for (const vrId of input.viewing_range_ids) {
      await client.query(
        `INSERT INTO standalone_file_viewing_ranges (standalone_file_id, viewing_range_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [fileId, vrId]
      )
    }
    for (const tag of input.tags) {
      if (!tag.trim()) continue
      await client.query(
        `INSERT INTO standalone_file_tags (standalone_file_id, tag) VALUES ($1, $2)`,
        [fileId, tag.trim()]
      )
    }
    await client.query(
      `INSERT INTO jobs (job_type, status, payload_json)
       VALUES ('extraction', 'pending', $1::jsonb)`,
      [JSON.stringify({ standalone_file_id: fileId, source: 'standalone' })]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  await writeAuditLog(pool, {
    userId: user.id,
    action: 'standalone_file.create',
    resourceType: 'standalone_file',
    resourceId: fileId,
    details: { title: input.title, file_name: input.fileName }
  })

  return { id: fileId, title: input.title, extraction_status: 'pending' }
}

export async function updateStandaloneViewingRanges (
  pool: pg.Pool,
  settings: Settings,
  user: AuthUser,
  fileId: string,
  viewingRangeIds: string[]
) {
  requireOperator(user)
  const { rows } = await pool.query(
    `SELECT id FROM standalone_files WHERE id = $1 AND deleted_at IS NULL`,
    [fileId]
  )
  if (!rows[0]) throw new AppError('not_found', 'Standalone file not found.', 404)

  await pool.query(
    `DELETE FROM standalone_file_viewing_ranges WHERE standalone_file_id = $1`,
    [fileId]
  )
  for (const vrId of viewingRangeIds) {
    await pool.query(
      `INSERT INTO standalone_file_viewing_ranges (standalone_file_id, viewing_range_id)
       VALUES ($1, $2)`,
      [fileId, vrId]
    )
  }

  await enqueueEmbeddingJob(pool, {
    source: 'rag_metadata_sync',
    standalone_file_id: fileId
  })

  await writeAuditLog(pool, {
    userId: user.id,
    action: 'standalone_file.viewing_range',
    resourceType: 'standalone_file',
    resourceId: fileId,
    details: { viewing_range_ids: viewingRangeIds }
  })

  const { items } = await listRagFiles(pool, {})
  return items.find((i) => i.id === fileId) ?? { id: fileId, viewing_range_ids: viewingRangeIds }
}

export async function enqueueCaseBodyEmbedding (
  pool: pg.Pool,
  caseId: string,
  displayId: string
) {
  await enqueueEmbeddingJob(pool, { source: 'case_body', case_id: caseId }, caseId, displayId)
}

// 閲覧範囲・条件変更時に、ケース配下チャンクの権限メタデータ再同期ジョブを投入する
export async function enqueueCaseMetadataSync (
  pool: pg.Pool,
  caseId: string,
  displayId: string
) {
  await enqueueEmbeddingJob(pool, { source: 'rag_metadata_sync', case_id: caseId }, caseId, displayId)
}

// ケース削除時にベクタとチャンクを掃除する。ベクタ削除失敗時も検索側の DB 再認可で fail-closed。
export async function purgeCaseVectors (
  pool: pg.Pool,
  settings: Settings,
  caseId: string
) {
  const { rows } = await pool.query<{ vector_point_id: string }>(
    `SELECT rs.vector_point_id
     FROM rag_sync_states rs
     JOIN rag_chunks rc ON rc.id = rs.chunk_id
     WHERE rc.case_id = $1`,
    [caseId]
  )
  try {
    await deletePoints(
      settings.vectorDbUrl,
      settings.vectorCollection,
      rows.map((r) => r.vector_point_id)
    )
  } catch {
    // 検索側 authorizeChunk が cases.deleted_at を再確認するため、残存ベクタは露出しない
  }
  await pool.query(
    `DELETE FROM rag_sync_states WHERE chunk_id IN (
      SELECT id FROM rag_chunks WHERE case_id = $1
    )`,
    [caseId]
  )
  await pool.query(`DELETE FROM rag_chunks WHERE case_id = $1`, [caseId])
}

export async function deleteStandaloneFile (
  pool: pg.Pool,
  settings: Settings,
  storage: S3Client,
  storageConfig: ObjectStorageSettings,
  user: AuthUser,
  fileId: string
) {
  requireOperator(user)
  const { rows } = await pool.query<{ storage_key: string; title: string }>(
    `SELECT storage_key, title FROM standalone_files WHERE id = $1 AND deleted_at IS NULL`,
    [fileId]
  )
  if (!rows[0]) throw new AppError('not_found', 'Standalone file not found.', 404)

  await purgeRagDataForSource(pool, settings, fileId, 'standalone')
  await deleteJobsForStandaloneFile(pool, fileId)
  await pool.query(
    `UPDATE standalone_files SET deleted_at = NOW(), rag_enabled = FALSE, updated_at = NOW()
     WHERE id = $1`,
    [fileId]
  )
  await deleteObject(storage, storageConfig.bucket, rows[0].storage_key).catch(() => {})

  await writeAuditLog(pool, {
    userId: user.id,
    action: 'standalone_file.delete',
    resourceType: 'standalone_file',
    resourceId: fileId,
    details: { title: rows[0].title }
  })

  return { id: fileId, deleted: true }
}

export async function reindexCase (
  pool: pg.Pool,
  user: AuthUser,
  caseId: string
) {
  requireOperator(user)
  const caseRow = await getCaseById(pool, user, caseId)
  let jobsEnqueued = 0

  await enqueueEmbeddingJob(
    pool,
    { source: 'case_body', case_id: caseId },
    caseId,
    caseRow.display_id as string
  )
  jobsEnqueued += 1

  const { rows: attachments } = await pool.query<{ id: string }>(
    `SELECT id FROM attachments
     WHERE case_id = $1 AND extraction_status = 'succeeded'`,
    [caseId]
  )
  for (const attachment of attachments) {
    await enqueueEmbeddingJob(
      pool,
      { source: 'attachment', attachment_id: attachment.id },
      caseId,
      caseRow.display_id as string,
      attachment.id
    )
    jobsEnqueued += 1
  }

  await writeAuditLog(pool, {
    userId: user.id,
    action: 'rag.reindex_case',
    resourceType: 'case',
    resourceId: caseId,
    caseDisplayId: caseRow.display_id as string,
    details: { jobs_enqueued: jobsEnqueued }
  })

  return { case_id: caseId, jobs_enqueued: jobsEnqueued }
}

export async function bulkReindexRag (pool: pg.Pool, user: AuthUser) {
  requireOperator(user)
  let jobsEnqueued = 0

  const { rows: caseBodies } = await pool.query<{ id: string; display_id: string }>(
    `SELECT DISTINCT c.id, c.display_id
     FROM cases c
     JOIN rag_chunks rc ON rc.case_id = c.id
     WHERE c.deleted_at IS NULL
       AND rc.attachment_id IS NULL
       AND rc.standalone_file_id IS NULL`
  )
  for (const row of caseBodies) {
    await enqueueEmbeddingJob(
      pool,
      { source: 'case_body', case_id: row.id },
      row.id,
      row.display_id
    )
    jobsEnqueued += 1
  }

  const { rows: attachments } = await pool.query<{ id: string; case_id: string; display_id: string }>(
    `SELECT a.id, a.case_id, c.display_id
     FROM attachments a
     JOIN cases c ON c.id = a.case_id
     WHERE c.deleted_at IS NULL
       AND a.rag_enabled = TRUE
       AND a.extraction_status = 'succeeded'`
  )
  for (const row of attachments) {
    await enqueueEmbeddingJob(
      pool,
      { source: 'attachment', attachment_id: row.id },
      row.case_id,
      row.display_id,
      row.id
    )
    jobsEnqueued += 1
  }

  const { rows: standalones } = await pool.query<{ id: string }>(
    `SELECT id FROM standalone_files
     WHERE deleted_at IS NULL
       AND rag_enabled = TRUE
       AND extraction_status = 'succeeded'`
  )
  for (const row of standalones) {
    await enqueueEmbeddingJob(pool, { source: 'standalone', standalone_file_id: row.id })
    jobsEnqueued += 1
  }

  await writeAuditLog(pool, {
    userId: user.id,
    action: 'rag.bulk_reindex',
    resourceType: 'rag',
    resourceId: 'bulk',
    details: { jobs_enqueued: jobsEnqueued }
  })

  return { jobs_enqueued: jobsEnqueued }
}
