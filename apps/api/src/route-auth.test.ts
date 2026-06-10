import { test } from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import { buildApp } from './app.js'
import type { Settings } from './settings.js'

const regularUserId = '00000000-0000-4000-8000-000000000099'

const settings: Settings = {
  host: '127.0.0.1',
  port: 0,
  databaseUrl: 'postgresql://test@localhost/test',
  ollamaBaseUrl: 'http://localhost:11434',
  vectorDbUrl: 'http://vector:6333',
  vectorCollection: 'aisss_chunks',
  migrateOnStart: false,
  migrationsDir: '/tmp',
  devUserId: null,
  objectStorage: {
    endpoint: 'http://localhost:9000',
    bucket: 'aisss',
    accessKey: 'test',
    secretKey: 'test'
  },
  maxUploadBytes: 1024
}

function createAuthOnlyPool (): pg.Pool {
  return {
    connect: async () => ({
      query: async () => ({ rows: [{ '?column?': 1 }] }),
      release: () => {}
    }),
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        assert.equal(params[0], regularUserId)
        return {
          rows: [{
            id: regularUserId,
            external_id: 'regular',
            display_name: 'Regular User',
            department_id: null,
            role: 'general'
          }]
        }
      }
      if (sql.includes('FROM user_groups')) {
        return { rows: [{ group_id: 'group-regular' }] }
      }
      if (sql.includes('FROM group_viewing_ranges')) {
        return { rows: [{ viewing_range_id: 'range-regular' }] }
      }
      throw new Error(`route should reject before data query: ${sql}`)
    },
    end: async () => {}
  } as unknown as pg.Pool
}

async function buildAuthTestApp () {
  return buildApp({
    settings,
    pool: createAuthOnlyPool(),
    storage: {} as never
  })
}

test('POST /api/ai/chat rejects unauthenticated requests', async (t) => {
  const app = await buildAuthTestApp()
  t.after(async () => { await app.close() })

  const response = await app.inject({
    method: 'POST',
    url: '/api/ai/chat',
    payload: { message: 'hello' }
  })

  assert.equal(response.statusCode, 401)
})

test('operational routes reject general users before data queries', async (t) => {
  const app = await buildAuthTestApp()
  t.after(async () => { await app.close() })

  const routes = [
    { method: 'GET', url: '/api/jobs' },
    { method: 'GET', url: '/api/jobs/stats' },
    { method: 'GET', url: '/api/admin/dashboard' },
    { method: 'POST', url: '/api/admin/backup-checks', payload: { scope: 'daily' } },
    { method: 'PUT', url: '/api/admin/ollama/model-roles', payload: { assignments: [] } },
    { method: 'GET', url: '/api/audit-logs?export=csv' },
    { method: 'PATCH', url: '/api/rag/files/file-1/enable', payload: { enabled: true, source_kind: 'case_attachment' } }
  ] as const

  for (const route of routes) {
    const response = await app.inject({
      ...route,
      headers: { 'X-AISSS-User-Id': regularUserId }
    })
    assert.equal(response.statusCode, 403, `${route.method} ${route.url}`)
  }
})
