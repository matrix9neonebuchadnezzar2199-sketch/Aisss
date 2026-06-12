import { randomUUID } from 'node:crypto'
import { embedText } from './ollama.js'
import { upsertPoints } from './qdrant.js'
import { getBuildingConfig } from './embedding-config.js'

const BATCH_SIZE = 50

function resolveReindexDeps (deps = {}) {
  return {
    embed: deps.embed ?? embedText,
    upsert: deps.upsert ?? upsertPoints
  }
}

async function loadReindexJob (pool, reindexJobId) {
  const { rows } = await pool.query(
    `SELECT rj.*, ec.model_name, ec.collection_name, ec.dimensions, ec.status AS config_status
     FROM reindex_jobs rj
     JOIN embedding_configs ec ON ec.id = rj.target_config_id
     WHERE rj.id = $1`,
    [reindexJobId]
  )
  return rows[0] ?? null
}

async function countEligibleChunks (pool) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM rag_chunks rc
     LEFT JOIN cases c ON c.id = rc.case_id
     LEFT JOIN attachments a ON a.id = rc.attachment_id
     LEFT JOIN standalone_files sf ON sf.id = rc.standalone_file_id
     WHERE (
       (rc.case_id IS NOT NULL AND rc.attachment_id IS NULL AND rc.standalone_file_id IS NULL
         AND c.deleted_at IS NULL)
       OR (rc.attachment_id IS NOT NULL AND c.deleted_at IS NULL
         AND a.rag_enabled = TRUE AND a.extraction_status = 'succeeded')
       OR (rc.standalone_file_id IS NOT NULL AND sf.deleted_at IS NULL
         AND sf.rag_enabled = TRUE AND sf.extraction_status = 'succeeded')
     )`
  )
  return rows[0]?.count ?? 0
}

function isChunkEligible (row) {
  if (row.standalone_file_id) {
    return row.sf_deleted == null && row.standalone_rag_enabled === true
      && row.standalone_extraction_status === 'succeeded'
  }
  if (row.attachment_id) {
    return row.case_deleted == null && row.attachment_rag_enabled === true
      && row.extraction_status === 'succeeded'
  }
  if (row.case_id) {
    return row.case_deleted == null
  }
  return false
}

async function loadViewingRangeIds (pool, caseId, cache) {
  if (cache.has(`case:${caseId}`)) return cache.get(`case:${caseId}`)
  const { rows } = await pool.query(
    `SELECT viewing_range_id FROM case_viewing_ranges WHERE case_id = $1`,
    [caseId]
  )
  const ids = rows.map((r) => r.viewing_range_id)
  cache.set(`case:${caseId}`, ids)
  return ids
}

async function loadStandaloneViewingRangeIds (pool, standaloneId, cache) {
  if (cache.has(`standalone:${standaloneId}`)) return cache.get(`standalone:${standaloneId}`)
  const { rows } = await pool.query(
    `SELECT viewing_range_id FROM standalone_file_viewing_ranges WHERE standalone_file_id = $1`,
    [standaloneId]
  )
  const ids = rows.map((r) => r.viewing_range_id)
  cache.set(`standalone:${standaloneId}`, ids)
  return ids
}

async function buildChunkPayload (pool, row, viewingCache) {
  const meta = row.metadata_json ?? {}
  if (row.standalone_file_id) {
    const viewingRangeIds = await loadStandaloneViewingRangeIds(pool, row.standalone_file_id, viewingCache)
    return {
      chunk_id: row.id,
      standalone_file_id: row.standalone_file_id,
      title: row.standalone_title,
      chunk_text: row.chunk_text,
      source_type: meta.source_type ?? 'standalone',
      viewing_range_ids: viewingRangeIds,
      rag_enabled: row.standalone_rag_enabled === true
    }
  }
  if (row.attachment_id) {
    const viewingRangeIds = await loadViewingRangeIds(pool, row.case_id, viewingCache)
    return {
      chunk_id: row.id,
      case_id: row.case_id,
      attachment_id: row.attachment_id,
      display_id: row.display_id,
      title: row.case_title,
      chunk_text: row.chunk_text,
      source_type: meta.source_type ?? 'attachment',
      viewing_range_ids: viewingRangeIds,
      rag_enabled: true
    }
  }
  const viewingRangeIds = await loadViewingRangeIds(pool, row.case_id, viewingCache)
  return {
    chunk_id: row.id,
    case_id: row.case_id,
    display_id: row.display_id,
    title: row.case_title,
    chunk_text: row.chunk_text,
    source_type: meta.source_type ?? 'case_body',
    viewing_range_ids: viewingRangeIds,
    rag_enabled: true
  }
}

async function chunkAlreadySynced (pool, chunkId, collectionName) {
  const { rows } = await pool.query(
    `SELECT 1 FROM rag_sync_states
     WHERE chunk_id = $1 AND vector_collection = $2
     LIMIT 1`,
    [chunkId, collectionName]
  )
  return rows.length > 0
}

async function fetchChunkBatch (pool, afterId) {
  const { rows } = await pool.query(
    `SELECT rc.id, rc.chunk_text, rc.case_id, rc.attachment_id, rc.standalone_file_id, rc.metadata_json,
            c.display_id, c.title AS case_title, c.deleted_at AS case_deleted,
            a.rag_enabled AS attachment_rag_enabled, a.extraction_status,
            sf.rag_enabled AS standalone_rag_enabled, sf.extraction_status AS standalone_extraction_status,
            sf.title AS standalone_title, sf.deleted_at AS sf_deleted
     FROM rag_chunks rc
     LEFT JOIN cases c ON c.id = rc.case_id
     LEFT JOIN attachments a ON a.id = rc.attachment_id
     LEFT JOIN standalone_files sf ON sf.id = rc.standalone_file_id
     WHERE rc.id > $1
     ORDER BY rc.id ASC
     LIMIT $2`,
    [afterId, BATCH_SIZE]
  )
  return rows
}

async function activateNewConfig (pool, reindexJob, targetConfigId, modelName) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE embedding_configs SET status = 'retired' WHERE status = 'active'`
    )
    await client.query(
      `UPDATE embedding_configs
       SET status = 'active', activated_at = NOW()
       WHERE id = $1`,
      [targetConfigId]
    )
    await client.query(
      `UPDATE ollama_model_roles SET is_default_embedding = FALSE WHERE is_default_embedding = TRUE`
    )
    await client.query(
      `INSERT INTO ollama_model_roles (
        model_name, roles, enabled_for_chat, is_default_chat, is_default_embedding, is_rerank, updated_at
      ) VALUES ($1, ARRAY['embedding']::text[], FALSE, FALSE, TRUE, FALSE, NOW())
       ON CONFLICT (model_name) DO UPDATE SET
         is_default_embedding = TRUE,
         roles = CASE
           WHEN 'embedding' = ANY(ollama_model_roles.roles) THEN ollama_model_roles.roles
           ELSE array_append(ollama_model_roles.roles, 'embedding')
         END,
         updated_at = NOW()`,
      [modelName]
    )
    await client.query(
      `UPDATE reindex_jobs
       SET status = 'completed', finished_at = NOW(), error_message = NULL
       WHERE id = $1`,
      [reindexJob.id]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function markReindexFailed (pool, reindexJobId, configId, message) {
  await pool.query(
    `UPDATE reindex_jobs
     SET status = 'failed', error_message = $2, finished_at = NOW()
     WHERE id = $1`,
    [reindexJobId, message]
  )
  await pool.query(
    `UPDATE embedding_configs SET status = 'failed' WHERE id = $1 AND status = 'building'`,
    [configId]
  )
}

async function enqueueEmbeddingJob (pool, payload, caseId, caseDisplayId, attachmentId) {
  await pool.query(
    `INSERT INTO jobs (job_type, status, case_id, case_display_id, attachment_id, payload_json)
     VALUES ('embedding', 'pending', $1, $2, $3, $4::jsonb)`,
    [caseId ?? null, caseDisplayId ?? null, attachmentId ?? null, JSON.stringify(payload)]
  )
}

/** reindex 完了後、新コレクションに未同期のソースへ差分 embedding ジョブを投入 */
async function enqueueDiffSources (pool, newCollection) {
  const { rows: caseBodies } = await pool.query(
    `SELECT DISTINCT c.id, c.display_id
     FROM cases c
     JOIN rag_chunks rc ON rc.case_id = c.id
       AND rc.attachment_id IS NULL AND rc.standalone_file_id IS NULL
     WHERE c.deleted_at IS NULL
       AND EXISTS (
         SELECT 1 FROM rag_chunks rc2
         WHERE rc2.case_id = c.id
           AND rc2.attachment_id IS NULL AND rc2.standalone_file_id IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM rag_sync_states rs
             WHERE rs.chunk_id = rc2.id AND rs.vector_collection = $1
           )
       )`,
    [newCollection]
  )
  for (const row of caseBodies) {
    await enqueueEmbeddingJob(
      pool,
      { source: 'case_body', case_id: row.id },
      row.id,
      row.display_id
    )
  }

  const { rows: attachments } = await pool.query(
    `SELECT DISTINCT a.id, a.case_id, c.display_id
     FROM attachments a
     JOIN cases c ON c.id = a.case_id
     JOIN rag_chunks rc ON rc.attachment_id = a.id
     WHERE c.deleted_at IS NULL
       AND a.rag_enabled = TRUE
       AND a.extraction_status = 'succeeded'
       AND EXISTS (
         SELECT 1 FROM rag_chunks rc2
         WHERE rc2.attachment_id = a.id
           AND NOT EXISTS (
             SELECT 1 FROM rag_sync_states rs
             WHERE rs.chunk_id = rc2.id AND rs.vector_collection = $1
           )
       )`,
    [newCollection]
  )
  for (const row of attachments) {
    await enqueueEmbeddingJob(
      pool,
      { source: 'attachment', attachment_id: row.id },
      row.case_id,
      row.display_id,
      row.id
    )
  }

  const { rows: standalones } = await pool.query(
    `SELECT DISTINCT sf.id
     FROM standalone_files sf
     JOIN rag_chunks rc ON rc.standalone_file_id = sf.id
     WHERE sf.deleted_at IS NULL
       AND sf.rag_enabled = TRUE
       AND sf.extraction_status = 'succeeded'
       AND EXISTS (
         SELECT 1 FROM rag_chunks rc2
         WHERE rc2.standalone_file_id = sf.id
           AND NOT EXISTS (
             SELECT 1 FROM rag_sync_states rs
             WHERE rs.chunk_id = rc2.id AND rs.vector_collection = $1
           )
       )`,
    [newCollection]
  )
  for (const row of standalones) {
    await enqueueEmbeddingJob(pool, { source: 'standalone', standalone_file_id: row.id })
  }

  return {
    case_bodies: caseBodies.length,
    attachments: attachments.length,
    standalones: standalones.length
  }
}

async function completeWorkerJob (pool, jobId) {
  await pool.query(
    `UPDATE jobs SET status = 'completed', error = NULL, updated_at = NOW(), completed_at = NOW()
     WHERE id = $1`,
    [jobId]
  )
}

export async function processReindexJob (pool, config, job, deps = {}) {
  const resolved = resolveReindexDeps(deps)
  const payload = job.payload_json ?? {}
  const reindexJobId = payload.reindex_job_id
  if (!reindexJobId) throw new Error('reindex_job_id missing in job payload')

  const reindexJob = await loadReindexJob(pool, reindexJobId)
  if (!reindexJob) throw new Error(`Reindex job not found: ${reindexJobId}`)
  if (reindexJob.status === 'completed') {
    await completeWorkerJob(pool, job.id)
    return { status: 'completed', skipped: true }
  }
  if (reindexJob.status === 'failed') {
    throw new Error(reindexJob.error_message ?? 'Reindex job already failed')
  }

  const modelName = reindexJob.model_name
  const collectionName = reindexJob.collection_name

  if (reindexJob.status === 'pending') {
    const total = await countEligibleChunks(pool)
    await pool.query(
      `UPDATE reindex_jobs
       SET status = 'running', started_at = NOW(), total_chunks = $2
       WHERE id = $1`,
      [reindexJobId, total]
    )
    reindexJob.total_chunks = total
    reindexJob.processed_chunks = 0
    reindexJob.failed_chunks = 0
  }

  let processed = reindexJob.processed_chunks ?? 0
  let failed = reindexJob.failed_chunks ?? 0
  let cursorId = '00000000-0000-0000-0000-000000000000'
  const viewingCache = new Map()

  while (true) {
    const batch = await fetchChunkBatch(pool, cursorId)
    if (batch.length === 0) break

    for (const row of batch) {
      cursorId = row.id
      if (!isChunkEligible(row)) {
        processed += 1
        continue
      }
      if (await chunkAlreadySynced(pool, row.id, collectionName)) {
        processed += 1
        continue
      }

      try {
        const pointId = randomUUID()
        const vector = await resolved.embed(config.ollamaBaseUrl, modelName, row.chunk_text)
        const qdrantPayload = await buildChunkPayload(pool, row, viewingCache)
        await resolved.upsert(config.vectorDbUrl, collectionName, [{
          id: pointId,
          vector,
          payload: qdrantPayload
        }])
        await pool.query(
          `INSERT INTO rag_sync_states (chunk_id, vector_collection, vector_point_id, sync_status, last_synced_at, updated_at)
           VALUES ($1, $2, $3, 'synced', NOW(), NOW())
           ON CONFLICT (chunk_id) DO UPDATE SET
             vector_collection = EXCLUDED.vector_collection,
             vector_point_id = EXCLUDED.vector_point_id,
             sync_status = EXCLUDED.sync_status,
             last_synced_at = EXCLUDED.last_synced_at,
             updated_at = NOW()`,
          [row.id, collectionName, pointId]
        )
        processed += 1
      } catch (error) {
        failed += 1
        console.error('[aisss-worker] reindex chunk failed', row.id, error)
      }
    }

    await pool.query(
      `UPDATE reindex_jobs SET processed_chunks = $2, failed_chunks = $3 WHERE id = $1`,
      [reindexJobId, processed, failed]
    )
    await pool.query(
      `UPDATE jobs SET updated_at = NOW() WHERE id = $1`,
      [job.id]
    )
  }

  try {
    await activateNewConfig(pool, reindexJob, reindexJob.target_config_id, modelName)
    const diff = await enqueueDiffSources(pool, collectionName)
    await completeWorkerJob(pool, job.id)
    return {
      status: 'completed',
      processed_chunks: processed,
      failed_chunks: failed,
      diff_enqueued: diff
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await markReindexFailed(pool, reindexJobId, reindexJob.target_config_id, message)
    throw error
  }
}

export {
  activateNewConfig,
  buildChunkPayload,
  countEligibleChunks,
  enqueueDiffSources,
  isChunkEligible,
  markReindexFailed
}
