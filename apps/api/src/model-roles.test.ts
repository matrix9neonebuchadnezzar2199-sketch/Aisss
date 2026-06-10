import { test } from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import { updateModelRoles } from './services/model-roles.js'
import type { AuthUser } from './types/auth.js'

const admin: AuthUser = {
  id: 'admin',
  externalId: null,
  displayName: 'Admin',
  departmentId: null,
  role: 'admin',
  groupIds: [],
  viewingRangeIds: []
}

function createPoolMock () {
  const queries: string[] = []
  const client = {
    async query (sql: string) {
      queries.push(sql)
      return { rows: [] }
    },
    release () {}
  }
  const pool = {
    async connect () {
      return client
    },
    async query (sql: string) {
      queries.push(sql)
      return { rows: [] }
    }
  } as unknown as pg.Pool
  return { pool, queries }
}

test('updateModelRoles clears stale default flags before assigning new ones', async () => {
  // Ollama から消えた残留行が default chat を握り続けないこと（dry-run D1 regression）
  const { pool, queries } = createPoolMock()

  await updateModelRoles(pool, admin, {
    assignments: [{
      model_name: 'new-chat-model',
      roles: ['chat'],
      enabled_for_chat: true,
      is_default_chat: true,
      is_default_embedding: false,
      is_rerank: false
    }]
  })

  const resetIndex = queries.findIndex((q) =>
    q.includes('SET is_default_chat = FALSE WHERE is_default_chat = TRUE')
  )
  const upsertIndex = queries.findIndex((q) => q.includes('INSERT INTO ollama_model_roles'))
  assert.ok(resetIndex >= 0, 'expected global is_default_chat reset query')
  assert.ok(upsertIndex > resetIndex, 'reset must run before upsert')
})

test('updateModelRoles does not reset defaults when no new default is assigned', async () => {
  const { pool, queries } = createPoolMock()

  await updateModelRoles(pool, admin, {
    assignments: [{
      model_name: 'aux-model',
      roles: [],
      enabled_for_chat: false,
      is_default_chat: false,
      is_default_embedding: false,
      is_rerank: false
    }]
  })

  assert.equal(
    queries.some((q) => q.includes('SET is_default_chat = FALSE WHERE is_default_chat = TRUE')),
    false
  )
})
