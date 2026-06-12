import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activateNewConfig,
  buildChunkPayload,
  isChunkEligible,
  markReindexFailed
} from './reindex.js'

test('isChunkEligible accepts active case body chunk', () => {
  assert.equal(isChunkEligible({
    case_id: 'case-1',
    attachment_id: null,
    standalone_file_id: null,
    case_deleted: null
  }), true)
})

test('isChunkEligible rejects deleted case chunk', () => {
  assert.equal(isChunkEligible({
    case_id: 'case-1',
    attachment_id: null,
    standalone_file_id: null,
    case_deleted: new Date()
  }), false)
})

test('buildChunkPayload includes viewing_range_ids and rag_enabled for case body', async () => {
  const pool = {
    async query (sql, params = []) {
      if (sql.includes('case_viewing_ranges')) {
        return { rows: [{ viewing_range_id: 'vr-1' }] }
      }
      throw new Error(`unexpected query: ${sql}`)
    }
  }

  const payload = await buildChunkPayload(pool, {
    id: 'chunk-1',
    chunk_text: 'hello',
    case_id: 'case-1',
    attachment_id: null,
    standalone_file_id: null,
    metadata_json: { source_type: 'case_body' },
    display_id: 'CASE-1',
    case_title: 'Title'
  }, new Map())

  assert.deepEqual(payload.viewing_range_ids, ['vr-1'])
  assert.equal(payload.rag_enabled, true)
  assert.equal(payload.source_type, 'case_body')
})

test('activateNewConfig retires old active config and promotes building config', async () => {
  const queries = []
  const client = {
    query: async (sql, params = []) => {
      queries.push({ sql, params })
      return { rows: [] }
    },
    release: () => {}
  }
  const pool = {
    connect: async () => client
  }

  await activateNewConfig(
    pool,
    { id: 'job-1' },
    'config-new',
    'qwen-embed:latest'
  )

  assert.ok(queries.some((q) => q.sql.includes("status = 'retired'") && q.sql.includes("status = 'active'")))
  assert.ok(queries.some((q) => q.sql.includes("status = 'active'") && q.params?.[0] === 'config-new'))
  assert.ok(queries.some((q) => q.sql.includes('is_default_embedding = TRUE') && q.params?.[0] === 'qwen-embed:latest'))
  const roleUpsert = queries.find((q) => q.sql.includes('ON CONFLICT (model_name)'))
  assert.ok(roleUpsert)
  assert.match(roleUpsert.sql, /array_append\(ollama_model_roles\.roles, 'embedding'\)/)
  assert.ok(queries.some((q) => q.sql.includes("reindex_jobs") && q.sql.includes("status = 'completed'")))
})

test('markReindexFailed leaves active config unchanged', async () => {
  const queries = []
  const pool = {
    query: async (sql, params = []) => {
      queries.push({ sql, params })
      return { rows: [] }
    }
  }

  await markReindexFailed(pool, 'job-1', 'config-new', 'boom')

  assert.ok(queries.some((q) => q.sql.includes("reindex_jobs") && q.params?.[1] === 'boom'))
  assert.ok(queries.some((q) => q.sql.includes("embedding_configs") && q.params?.[0] === 'config-new'))
  assert.equal(queries.some((q) => q.sql.includes("status = 'retired'")), false)
})
