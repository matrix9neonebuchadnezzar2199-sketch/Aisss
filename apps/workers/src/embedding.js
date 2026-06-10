import { randomUUID } from 'node:crypto'
import { chunkText } from './chunk.js'
import { embedText } from './ollama.js'
import { ensureCollection, upsertPoints } from './qdrant.js'

function resolveEmbeddingDeps (deps = {}) {
  return {
    getEmbeddingModel: deps.getEmbeddingModel ?? getEmbeddingModel,
    embed: deps.embed ?? embedText,
    ensureCollection: deps.ensureCollection ?? ensureCollection,
    upsert: deps.upsert ?? upsertPoints
  }
}

async function getEmbeddingModel (pool) {
  const { rows } = await pool.query(
    `SELECT model_name FROM ollama_model_roles WHERE is_default_embedding = TRUE LIMIT 1`
  )
  return rows[0]?.model_name ?? null
}

async function loadViewingRangeIds (pool, caseId) {
  const { rows } = await pool.query(
    `SELECT viewing_range_id FROM case_viewing_ranges WHERE case_id = $1`,
    [caseId]
  )
  return rows.map((r) => r.viewing_range_id)
}

async function loadStandaloneViewingRangeIds (pool, standaloneId) {
  const { rows } = await pool.query(
    `SELECT viewing_range_id FROM standalone_file_viewing_ranges WHERE standalone_file_id = $1`,
    [standaloneId]
  )
  return rows.map((r) => r.viewing_range_id)
}

async function clearChunksForSource (pool, whereSql, param) {
  const { rows } = await pool.query(
    `SELECT rs.vector_point_id
     FROM rag_sync_states rs
     JOIN rag_chunks rc ON rc.id = rs.chunk_id
     WHERE ${whereSql}`,
    [param]
  )
  await pool.query(
    `DELETE FROM rag_sync_states WHERE chunk_id IN (
      SELECT id FROM rag_chunks WHERE ${whereSql}
    )`,
    [param]
  )
  await pool.query(`DELETE FROM rag_chunks WHERE ${whereSql}`, [param])
  return rows.map((r) => r.vector_point_id)
}

export async function processEmbeddingJob (pool, config, job, deps = {}) {
  const resolved = resolveEmbeddingDeps(deps)
  const payload = job.payload_json ?? {}
  const model = await resolved.getEmbeddingModel(pool)
  if (!model) throw new Error('No default embedding model configured')

  const sampleVector = await resolved.embed(config.ollamaBaseUrl, model, 'dimension probe')
  await resolved.ensureCollection(config.vectorDbUrl, config.vectorCollection, sampleVector.length)

  if (payload.source === 'case_body' && payload.case_id) {
    return embedCaseBody(pool, config, job, payload.case_id, model, sampleVector.length, resolved)
  }

  if (payload.source === 'attachment' || job.attachment_id) {
    const attachmentId = payload.attachment_id ?? job.attachment_id
    return embedAttachment(pool, config, job, attachmentId, model, sampleVector.length, resolved)
  }

  if (payload.source === 'standalone' || payload.standalone_file_id) {
    const standaloneId = payload.standalone_file_id
    return embedStandalone(pool, config, job, standaloneId, model, sampleVector.length, resolved)
  }

  if (payload.source === 'rag_metadata_sync') {
    const standaloneId = payload.standalone_file_id
    if (standaloneId) {
      const result = await resyncStandaloneMetadata(pool, config, standaloneId, model, sampleVector.length, resolved)
      await completeJob(pool, job.id)
      return result
    }
  }

  throw new Error(`Unknown embedding payload: ${JSON.stringify(payload)}`)
}

async function embedCaseBody (pool, config, job, caseId, model, vectorSize, resolved) {
  const { rows } = await pool.query(
    `SELECT id, display_id, title, body_summary, body_article, body_assessment, body_reference, rag_enabled
     FROM cases WHERE id = $1 AND deleted_at IS NULL`,
    [caseId]
  )
  const row = rows[0]
  if (!row) throw new Error(`Case not found: ${caseId}`)

  const text = [row.body_summary, row.body_article, row.body_assessment, row.body_reference]
    .filter(Boolean)
    .join('\n\n')
  if (!text.trim()) {
    await completeJob(pool, job.id)
    return { status: 'completed', chunks: 0 }
  }

  await clearChunksForSource(pool, 'case_id = $1 AND attachment_id IS NULL AND standalone_file_id IS NULL', [caseId])
  const viewingRangeIds = await loadViewingRangeIds(pool, caseId)
  const chunks = chunkText(text)
  let synced = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = randomUUID()
    const pointId = randomUUID()
    const vector = await resolved.embed(config.ollamaBaseUrl, model, chunks[i])
    await pool.query(
      `INSERT INTO rag_chunks (id, case_id, chunk_index, chunk_text, metadata_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        chunkId,
        caseId,
        i,
        chunks[i],
        JSON.stringify({
          source_type: 'case_body',
          display_id: row.display_id,
          title: row.title
        })
      ]
    )
    await resolved.upsert(config.vectorDbUrl, config.vectorCollection, [{
      id: pointId,
      vector,
      payload: {
        chunk_id: chunkId,
        case_id: caseId,
        display_id: row.display_id,
        title: row.title,
        chunk_text: chunks[i],
        source_type: 'case_body',
        viewing_range_ids: viewingRangeIds,
        rag_enabled: true
      }
    }])
    await pool.query(
      `INSERT INTO rag_sync_states (chunk_id, vector_collection, vector_point_id, sync_status, last_synced_at)
       VALUES ($1, $2, $3, 'synced', NOW())`,
      [chunkId, config.vectorCollection, pointId]
    )
    synced++
  }

  await completeJob(pool, job.id)
  return { status: 'completed', chunks: synced }
}

async function embedAttachment (pool, config, job, attachmentId, model, vectorSize, resolved) {
  const { rows } = await pool.query(
    `SELECT a.*, c.display_id, c.title, c.id AS case_id
     FROM attachments a
     JOIN cases c ON c.id = a.case_id
     WHERE a.id = $1`,
    [attachmentId]
  )
  const attachment = rows[0]
  if (!attachment) throw new Error(`Attachment not found: ${attachmentId}`)
  if (!attachment.rag_enabled) {
    await completeJob(pool, job.id)
    return { status: 'skipped', reason: 'rag_disabled' }
  }
  if (attachment.extraction_status !== 'succeeded') {
    throw new Error('Extraction not succeeded')
  }

  const { rows: texts } = await pool.query(
    `SELECT id, text, source_type FROM extracted_texts
     WHERE attachment_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [attachmentId]
  )
  const extracted = texts[0]
  if (!extracted?.text) throw new Error('No extracted text')

  await clearChunksForSource(pool, 'attachment_id = $1', [attachmentId])
  const viewingRangeIds = await loadViewingRangeIds(pool, attachment.case_id)
  const chunks = chunkText(extracted.text)
  let synced = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = randomUUID()
    const pointId = randomUUID()
    const vector = await resolved.embed(config.ollamaBaseUrl, model, chunks[i])
    await pool.query(
      `INSERT INTO rag_chunks (
        id, case_id, attachment_id, extracted_text_id, chunk_index, chunk_text, metadata_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [
        chunkId,
        attachment.case_id,
        attachmentId,
        extracted.id,
        i,
        chunks[i],
        JSON.stringify({ source_type: extracted.source_type, file_name: attachment.file_name })
      ]
    )
    await resolved.upsert(config.vectorDbUrl, config.vectorCollection, [{
      id: pointId,
      vector,
      payload: {
        chunk_id: chunkId,
        case_id: attachment.case_id,
        attachment_id: attachmentId,
        display_id: attachment.display_id,
        title: attachment.title,
        chunk_text: chunks[i],
        source_type: extracted.source_type,
        viewing_range_ids: viewingRangeIds,
        rag_enabled: true
      }
    }])
    await pool.query(
      `INSERT INTO rag_sync_states (chunk_id, vector_collection, vector_point_id, sync_status, last_synced_at)
       VALUES ($1, $2, $3, 'synced', NOW())`,
      [chunkId, config.vectorCollection, pointId]
    )
    synced++
  }

  await completeJob(pool, job.id)
  return { status: 'completed', chunks: synced }
}

async function embedStandalone (pool, config, job, standaloneId, model, vectorSize, resolved) {
  const { rows } = await pool.query(
    `SELECT * FROM standalone_files WHERE id = $1 AND deleted_at IS NULL`,
    [standaloneId]
  )
  const file = rows[0]
  if (!file) throw new Error(`Standalone file not found: ${standaloneId}`)
  if (!file.rag_enabled) {
    await completeJob(pool, job.id)
    return { status: 'skipped' }
  }
  if (file.extraction_status !== 'succeeded') {
    throw new Error('Extraction not succeeded')
  }

  const { rows: texts } = await pool.query(
    `SELECT id, text, source_type FROM extracted_texts
     WHERE standalone_file_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [standaloneId]
  )
  const extracted = texts[0]
  if (!extracted?.text) throw new Error('No extracted text')

  await clearChunksForSource(pool, 'standalone_file_id = $1', [standaloneId])
  const viewingRangeIds = await loadStandaloneViewingRangeIds(pool, standaloneId)
  const chunks = chunkText(extracted.text)
  let synced = 0

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = randomUUID()
    const pointId = randomUUID()
    const vector = await resolved.embed(config.ollamaBaseUrl, model, chunks[i])
    await pool.query(
      `INSERT INTO rag_chunks (
        id, standalone_file_id, extracted_text_id, chunk_index, chunk_text, metadata_json
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        chunkId,
        standaloneId,
        extracted.id,
        i,
        chunks[i],
        JSON.stringify({ source_type: extracted.source_type, file_name: file.file_name })
      ]
    )
    await resolved.upsert(config.vectorDbUrl, config.vectorCollection, [{
      id: pointId,
      vector,
      payload: {
        chunk_id: chunkId,
        standalone_file_id: standaloneId,
        title: file.title,
        chunk_text: chunks[i],
        source_type: extracted.source_type,
        viewing_range_ids: viewingRangeIds,
        rag_enabled: true
      }
    }])
    await pool.query(
      `INSERT INTO rag_sync_states (chunk_id, vector_collection, vector_point_id, sync_status, last_synced_at)
       VALUES ($1, $2, $3, 'synced', NOW())`,
      [chunkId, config.vectorCollection, pointId]
    )
    synced++
  }

  await completeJob(pool, job.id)
  return { status: 'completed', chunks: synced }
}

async function resyncStandaloneMetadata (pool, config, standaloneId, model, vectorSize, resolved) {
  const viewingRangeIds = await loadStandaloneViewingRangeIds(pool, standaloneId)
  const { rows } = await pool.query(
    `SELECT rs.vector_point_id, rc.id AS chunk_id, rc.chunk_text, rc.metadata_json, sf.title, sf.rag_enabled
     FROM rag_chunks rc
     JOIN rag_sync_states rs ON rs.chunk_id = rc.id
     JOIN standalone_files sf ON sf.id = rc.standalone_file_id
     WHERE rc.standalone_file_id = $1`,
    [standaloneId]
  )

  for (const row of rows) {
    const meta = row.metadata_json ?? {}
    const vector = await resolved.embed(config.ollamaBaseUrl, model, row.chunk_text)
    await resolved.upsert(config.vectorDbUrl, config.vectorCollection, [{
      id: row.vector_point_id,
      vector,
      payload: {
        chunk_id: row.chunk_id,
        standalone_file_id: standaloneId,
        title: row.title,
        chunk_text: row.chunk_text,
        source_type: meta.source_type ?? 'standalone',
        viewing_range_ids: viewingRangeIds,
        rag_enabled: row.rag_enabled
      }
    }])
  }

  return { status: 'completed', resynced: rows.length }
}

async function completeJob (pool, jobId) {
  await pool.query(
    `UPDATE jobs SET status = 'completed', error = NULL, updated_at = NOW(), completed_at = NOW()
     WHERE id = $1`,
    [jobId]
  )
}
