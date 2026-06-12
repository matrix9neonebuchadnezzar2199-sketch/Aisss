import type pg from 'pg'
import { AppError } from '../lib/errors.js'
import type { AuthUser } from '../types/auth.js'
import type { Settings } from '../settings.js'
import { isAdmin } from './permissions.js'
import { embedText } from './ollama-client.js'
import { createCollection } from './qdrant.js'
import { writeAuditLog } from './audit.js'

export type ReindexJobRow = {
  id: string
  target_config_id: string
  status: string
  total_chunks: number
  processed_chunks: number
  failed_chunks: number
  error_message: string | null
  started_at: Date | null
  finished_at: Date | null
  created_at: Date
  model_name?: string
}

function requireAdmin (user: AuthUser) {
  if (!isAdmin(user)) {
    throw new AppError('permission_denied', 'Administrator role required.', 403)
  }
}

async function assertNoActiveReindex (pool: pg.Pool) {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM reindex_jobs
     WHERE status IN ('pending', 'running')
     LIMIT 1`
  )
  if (rows[0]) {
    throw new AppError('conflict', 'A reindex job is already pending or running.', 409)
  }
}

/** Ollama embed 疎通 + 次元実測 */
export async function probeEmbeddingModel (
  ollamaBaseUrl: string,
  modelName: string,
  embedFn: typeof embedText = embedText
): Promise<number> {
  try {
    const vector = await embedFn(ollamaBaseUrl, modelName, 'dimension probe')
    if (!vector.length) {
      throw new AppError('validation_error', 'Embedding model returned an empty vector.', 400)
    }
    return vector.length
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'ollama_error') {
        const hint = /does not support embeddings/i.test(error.message)
          ? ' Ollama がこのモデルを embedding 非対応と判定しています（VL embedding や chat モデルは不可）。`qwen3-embedding` や `bge-m3` 等の embedding 専用モデルを使用してください。'
          : ''
        throw new AppError(
          'validation_error',
          `Embedding precheck failed for "${modelName}": ${error.message}.${hint}`,
          400
        )
      }
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new AppError(
      'validation_error',
      `Embedding precheck failed for "${modelName}": ${message}`,
      400
    )
  }
}

export async function startReindex (
  pool: pg.Pool,
  settings: Settings,
  user: AuthUser,
  modelName: string
) {
  requireAdmin(user)
  const trimmed = modelName.trim()
  if (!trimmed) {
    throw new AppError('validation_error', 'model_name is required.', 400)
  }

  await assertNoActiveReindex(pool)
  const dimensions = await probeEmbeddingModel(settings.ollamaBaseUrl, trimmed)

  const collectionName = `aisss_chunks_${Date.now()}`
  await createCollection(settings.vectorDbUrl, collectionName, dimensions)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const configResult = await client.query<{ id: string }>(
      `INSERT INTO embedding_configs (model_name, dimensions, collection_name, status)
       VALUES ($1, $2, $3, 'building')
       RETURNING id`,
      [trimmed, dimensions, collectionName]
    )
    const configId = configResult.rows[0].id

    const jobResult = await client.query<{ id: string }>(
      `INSERT INTO reindex_jobs (target_config_id, status)
       VALUES ($1, 'pending')
       RETURNING id`,
      [configId]
    )
    const reindexJobId = jobResult.rows[0].id

    await client.query(
      `INSERT INTO jobs (job_type, status, payload_json)
       VALUES ('reindex', 'pending', $1::jsonb)`,
      [JSON.stringify({ reindex_job_id: reindexJobId })]
    )

    await client.query('COMMIT')

    await writeAuditLog(pool, {
      userId: user.id,
      action: 'rag.reindex_start',
      resourceType: 'embedding_config',
      resourceId: configId,
      details: { model_name: trimmed, collection_name: collectionName, dimensions }
    })

    return { reindex_job_id: reindexJobId, collection_name: collectionName, dimensions }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export function computeReindexPercent (processed: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((processed / total) * 100))
}

export async function getCurrentReindexJob (pool: pg.Pool, user: AuthUser) {
  requireAdmin(user)
  const { rows } = await pool.query<ReindexJobRow>(
    `SELECT rj.id, rj.target_config_id, rj.status, rj.total_chunks, rj.processed_chunks,
            rj.failed_chunks, rj.error_message, rj.started_at, rj.finished_at, rj.created_at,
            ec.model_name
     FROM reindex_jobs rj
     JOIN embedding_configs ec ON ec.id = rj.target_config_id
     ORDER BY rj.created_at DESC
     LIMIT 1`
  )
  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    status: row.status,
    total_chunks: row.total_chunks,
    processed_chunks: row.processed_chunks,
    failed_chunks: row.failed_chunks,
    percent: computeReindexPercent(row.processed_chunks, row.total_chunks),
    model_name: row.model_name ?? null,
    started_at: row.started_at?.toISOString() ?? null,
    finished_at: row.finished_at?.toISOString() ?? null,
    error_message: row.error_message
  }
}
