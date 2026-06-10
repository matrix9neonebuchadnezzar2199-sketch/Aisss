import { test } from 'node:test'
import assert from 'node:assert/strict'
import { processEmbeddingJob } from './embedding.js'

const config = {
  ollamaBaseUrl: 'http://ollama',
  vectorDbUrl: 'http://qdrant',
  vectorCollection: 'aisss_chunks'
}

function createDeps (overrides = {}) {
  const upsertCalls = []
  return {
    upsertCalls,
    deps: {
      getEmbeddingModel: async () => 'embed-model',
      embed: async () => [0.1, 0.2, 0.3],
      ensureCollection: async () => {},
      upsert: async (...args) => {
        upsertCalls.push(args)
      },
      ...overrides
    }
  }
}

function createPoolMock (fixture, options = {}) {
  const queryLog = []
  return {
    queryLog,
    pool: {
      async query (sql, params = []) {
        queryLog.push({ sql, params })
        if (sql.includes('FROM ollama_model_roles')) {
          return { rows: [{ model_name: 'embed-model' }] }
        }
        if (sql.includes('FROM cases WHERE id = $1')) {
          return { rows: fixture.case ? [fixture.case] : [] }
        }
        if (sql.includes('FROM case_viewing_ranges')) {
          return {
            rows: (fixture.caseViewingRangeIds ?? []).map((viewing_range_id) => ({ viewing_range_id }))
          }
        }
        if (sql.includes('FROM attachments a')) {
          return { rows: fixture.attachment ? [fixture.attachment] : [] }
        }
        if (sql.includes('FROM extracted_texts')) {
          return { rows: fixture.extractedText ? [fixture.extractedText] : [] }
        }
        if (sql.includes('FROM rag_sync_states rs')) {
          return { rows: [] }
        }
        if (sql.includes('DELETE FROM rag_sync_states')) {
          return { rowCount: 0 }
        }
        if (sql.includes('DELETE FROM rag_chunks')) {
          return { rowCount: 0 }
        }
        if (sql.includes('INSERT INTO rag_chunks')) {
          return { rowCount: 1 }
        }
        if (sql.includes('INSERT INTO rag_sync_states')) {
          return { rowCount: 1 }
        }
        if (sql.includes('UPDATE jobs SET status')) {
          return { rowCount: 1 }
        }
        if (options.throwOnUnknown) {
          throw new Error(`Unexpected query in test pool: ${sql}`)
        }
        return { rows: [] }
      }
    }
  }
}

test('processEmbeddingJob upserts case body payload with viewing range metadata', async () => {
  const { pool, queryLog } = createPoolMock({
    case: {
      id: 'case-1',
      display_id: 'CASE-1',
      title: 'Case title',
      body_summary: null,
      body_article: 'Article body text',
      body_assessment: null,
      body_reference: null,
      rag_enabled: true
    },
    caseViewingRangeIds: ['vr-a', 'vr-b']
  })
  const { deps, upsertCalls } = createDeps()

  const result = await processEmbeddingJob(
    pool,
    config,
    {
      id: 'job-1',
      attachment_id: null,
      payload_json: { source: 'case_body', case_id: 'case-1' }
    },
    deps
  )

  assert.equal(result.status, 'completed')
  assert.equal(result.chunks, 1)
  assert.equal(upsertCalls.length, 1)

  const points = upsertCalls[0][2]
  assert.equal(points.length, 1)
  const payload = points[0].payload
  assert.equal(typeof payload.chunk_id, 'string')
  assert.equal(payload.case_id, 'case-1')
  assert.equal(payload.display_id, 'CASE-1')
  assert.equal(payload.title, 'Case title')
  assert.equal(payload.chunk_text, 'Article body text')
  assert.equal(payload.source_type, 'case_body')
  assert.deepEqual(payload.viewing_range_ids, ['vr-a', 'vr-b'])
  assert.equal(payload.rag_enabled, true)

  // 現状仕様: 取扱条件は payload に載せず、検索側の DB 再認可で判定する。
  assert.equal(points[0].payload.search_policy, undefined)
  assert.equal(points[0].payload.condition_names, undefined)

  const deleteChunkIndex = queryLog.findIndex((q) => q.sql.includes('DELETE FROM rag_chunks'))
  const upsertIndex = queryLog.findIndex((q) => q.sql.includes('INSERT INTO rag_sync_states'))
  assert.ok(deleteChunkIndex >= 0)
  assert.ok(upsertIndex >= 0)
  assert.ok(deleteChunkIndex < upsertIndex)
})

test('processEmbeddingJob skips attachment upsert when rag_enabled is false', async () => {
  const { pool } = createPoolMock({
    attachment: {
      id: 'att-1',
      case_id: 'case-1',
      display_id: 'CASE-1',
      title: 'Case title for attachment',
      file_name: 'report.pdf',
      rag_enabled: false,
      extraction_status: 'succeeded'
    }
  })
  const { deps, upsertCalls } = createDeps()

  const result = await processEmbeddingJob(
    pool,
    config,
    {
      id: 'job-2',
      attachment_id: 'att-1',
      payload_json: { source: 'attachment', attachment_id: 'att-1' }
    },
    deps
  )

  assert.deepEqual(result, { status: 'skipped', reason: 'rag_disabled' })
  assert.equal(upsertCalls.length, 0)
})

test('processEmbeddingJob uses case title in attachment payload citation fields', async () => {
  const { pool } = createPoolMock({
    attachment: {
      id: 'att-1',
      case_id: 'case-1',
      display_id: 'CASE-1',
      title: 'Case title for attachment',
      file_name: 'report.pdf',
      rag_enabled: true,
      extraction_status: 'succeeded'
    },
    caseViewingRangeIds: ['vr-a'],
    extractedText: {
      id: 'ext-1',
      text: 'Extracted attachment text',
      source_type: 'attachment_pdf'
    }
  })
  const { deps, upsertCalls } = createDeps()

  await processEmbeddingJob(
    pool,
    config,
    {
      id: 'job-3',
      attachment_id: 'att-1',
      payload_json: { source: 'attachment', attachment_id: 'att-1' }
    },
    deps
  )

  assert.equal(upsertCalls.length, 1)
  const payload = upsertCalls[0][2][0].payload
  assert.equal(payload.title, 'Case title for attachment')
  assert.equal(payload.display_id, 'CASE-1')
  assert.equal(payload.source_type, 'attachment_pdf')
  assert.deepEqual(payload.viewing_range_ids, ['vr-a'])
  assert.equal(payload.rag_enabled, true)
})
