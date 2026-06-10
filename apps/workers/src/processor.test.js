import { test } from 'node:test'
import assert from 'node:assert/strict'
import { markJobFailed, processExtractionJob } from './processor.js'

const storageConfig = { bucket: 'aisss' }
const job = {
  id: 'job-1',
  attachment_id: 'att-1',
  payload_json: { attachment_id: 'att-1' }
}

function createPoolMock ({
  ragEnabled = false,
  autoEnable = false,
  hasViewingRange = true
} = {}) {
  const queryLog = []
  const attachment = {
    id: 'att-1',
    case_id: 'case-1',
    display_id: 'CASE-1',
    file_name: 'notes.txt',
    storage_key: 'cases/case-1/att-1/notes.txt',
    attachment_kind: 'text',
    rag_enabled: ragEnabled,
    auto_enable_rag_on_extraction: autoEnable
  }

  return {
    queryLog,
    pool: {
      async query (sql, params = []) {
        queryLog.push({ sql, params })
        if (sql.includes('FROM attachments a')) {
          return { rows: [attachment] }
        }
        if (sql.includes('FROM case_viewing_ranges')) {
          return { rows: hasViewingRange ? [{ '?column?': 1 }] : [] }
        }
        return { rows: [], rowCount: 1 }
      }
    }
  }
}

function createDeps (result = { text: 'extracted text', sourceType: 'text', engine: 'test' }) {
  return {
    download: async () => Buffer.from('file body', 'utf8'),
    extract: async () => result
  }
}

function countQueries (queryLog, fragment) {
  return queryLog.filter((q) => q.sql.includes(fragment)).length
}

test('processExtractionJob auto-enables RAG and enqueues embedding after successful extraction', async () => {
  const { pool, queryLog } = createPoolMock({ autoEnable: true, hasViewingRange: true })

  const result = await processExtractionJob(pool, {}, storageConfig, job, createDeps())

  assert.deepEqual(result, { status: 'completed', chars: 'extracted text'.length })
  assert.equal(countQueries(queryLog, 'UPDATE attachments SET rag_enabled = TRUE'), 1)
  assert.equal(countQueries(queryLog, `VALUES ('embedding'`), 1)
})

test('processExtractionJob keeps auto-enable reservation pending when case has no viewing range', async () => {
  const { pool, queryLog } = createPoolMock({ autoEnable: true, hasViewingRange: false })

  await processExtractionJob(pool, {}, storageConfig, job, createDeps())

  assert.equal(countQueries(queryLog, 'UPDATE attachments SET rag_enabled = TRUE'), 0)
  assert.equal(countQueries(queryLog, `VALUES ('embedding'`), 0)
})

test('processExtractionJob does not enqueue embedding when auto-enable is off', async () => {
  const { pool, queryLog } = createPoolMock({ autoEnable: false, hasViewingRange: true })

  await processExtractionJob(pool, {}, storageConfig, job, createDeps())

  assert.equal(countQueries(queryLog, 'UPDATE attachments SET rag_enabled = TRUE'), 0)
  assert.equal(countQueries(queryLog, `VALUES ('embedding'`), 0)
})

test('processExtractionJob still enqueues embedding when RAG is already enabled', async () => {
  const { pool, queryLog } = createPoolMock({ ragEnabled: true, autoEnable: false, hasViewingRange: false })

  await processExtractionJob(pool, {}, storageConfig, job, createDeps())

  assert.equal(countQueries(queryLog, 'FROM case_viewing_ranges'), 0)
  assert.equal(countQueries(queryLog, `VALUES ('embedding'`), 1)
})

test('processExtractionJob preserves attachment record and skips embedding when extraction fails', async () => {
  const { pool, queryLog } = createPoolMock({ autoEnable: true, hasViewingRange: true })

  const result = await processExtractionJob(
    pool,
    {},
    storageConfig,
    job,
    createDeps({ error: 'parse failed' })
  )

  assert.deepEqual(result, { status: 'failed', error: 'parse failed' })
  assert.equal(countQueries(queryLog, `UPDATE attachments SET extraction_status = 'failed'`), 1)
  assert.equal(countQueries(queryLog, `VALUES ('embedding'`), 0)
})

test('markJobFailed dead-letters jobs that reached max attempts', async () => {
  const calls = []
  const pool = {
    async query (sql, params) {
      calls.push({ sql, params })
      return { rows: [], rowCount: 1 }
    }
  }

  const result = await markJobFailed(
    pool,
    { id: 'job-1', retry_count: 2, max_attempts: 3 },
    new Error('embedding failed')
  )

  assert.deepEqual(result, {
    status: 'dead_letter',
    error: 'embedding failed',
    retry_count: 3
  })
  assert.equal(calls[0].params[1], 'dead_letter')
})
