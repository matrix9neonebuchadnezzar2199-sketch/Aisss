import { test } from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import { runAiChat } from './services/ai-chat.js'
import type { Settings } from './settings.js'
import type { AuthUser } from './types/auth.js'

const settings: Settings = {
  host: '127.0.0.1',
  port: 0,
  databaseUrl: 'postgresql://test@localhost/test',
  ollamaBaseUrl: 'http://ollama',
  vectorDbUrl: 'http://qdrant',
  vectorCollection: 'aisss_chunks',
  migrateOnStart: false,
  migrationsDir: '/tmp',
  devUserId: null,
  objectStorage: {
    endpoint: 'http://minio',
    bucket: 'aisss',
    accessKey: 'test',
    secretKey: 'test'
  },
  maxUploadBytes: 1024
}

const user: AuthUser = {
  id: 'user-1',
  externalId: null,
  displayName: 'User',
  departmentId: null,
  role: 'operator',
  groupIds: [],
  viewingRangeIds: []
}

test('runAiChat audit details keep denied citation metadata out', async () => {
  const auditCalls: unknown[] = []
  const pool = {} as pg.Pool

  const result = await runAiChat(
    pool,
    settings,
    user,
    { message: 'question' },
    {
      checkHealth: async () => ({ status: 'ok', latency_ms: 1 }),
      getDefaults: async () => ({
        chat_model: 'chat-model',
        embedding_model: 'embed-model',
        rerank_model: null,
        rerank_enabled: false,
        enabled_chat_models: ['chat-model']
      }),
      search: async () => ({
        contexts: [{
          chunk_id: 'chunk-allowed',
          case_id: 'case-allowed',
          display_id: 'CASE-OK',
          title: 'Allowed title',
          text: 'Allowed text',
          source_type: 'case_body',
          citation: 'CASE-OK / Allowed title',
          policies: {
            quote_policy: 'allow',
            export_policy: 'allow',
            condition_names: []
          }
        }],
        effective_policies: {
          quote_policy: 'allow',
          export_policy: 'allow',
          condition_names: []
        },
        excluded_counts: { search_policy: 1 }
      }),
      complete: async () => 'answer',
      audit: async (_pool, input) => {
        auditCalls.push(input)
      }
    }
  )

  assert.equal(result.answer, 'answer')
  assert.equal(auditCalls.length, 1)
  const serializedAudit = JSON.stringify(auditCalls[0])
  assert.match(serializedAudit, /search_policy/)
  assert.match(serializedAudit, /case-allowed/)
  assert.doesNotMatch(serializedAudit, /SECRET-9/)
  assert.doesNotMatch(serializedAudit, /Secret denied title/)
})
