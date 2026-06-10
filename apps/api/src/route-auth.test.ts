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

test('empty JSON body returns 400 instead of masked 500', async (t) => {
  // WebUI の retry 系は Content-Type: application/json で body 無し POST を送ることがある。
  // Fastify の FST_ERR_CTP_EMPTY_JSON_BODY (400) を internal_error 500 に丸めない（dry-run D3）。
  const app = await buildAuthTestApp()
  t.after(async () => { await app.close() })

  const response = await app.inject({
    method: 'POST',
    url: '/api/jobs/00000000-0000-4000-8000-00000000dddd/retry',
    headers: {
      'X-AISSS-User-Id': regularUserId,
      'Content-Type': 'application/json'
    }
  })

  assert.equal(response.statusCode, 400)
  const body = response.json() as { error: { code: string } }
  assert.notEqual(body.error.code, 'internal_error')
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
    { method: 'PATCH', url: '/api/rag/files/file-1/enable', payload: { enabled: true, source_kind: 'case_attachment' } },
    { method: 'POST', url: '/api/masters/material-types', payload: { name: 'new type' } },
    { method: 'PATCH', url: '/api/masters/material-types/00000000-0000-4000-8000-00000000aaaa', payload: { name: 'renamed' } },
    { method: 'POST', url: '/api/masters/conditions', payload: { name: '新条件' } },
    { method: 'POST', url: '/api/masters/viewing-ranges/00000000-0000-4000-8000-00000000bbbb/deactivate' },
    { method: 'PATCH', url: '/api/attachments/00000000-0000-4000-8000-00000000cccc/auto-enable-rag', payload: { enabled: true } },
    { method: 'GET', url: '/api/users' },
    { method: 'GET', url: '/api/groups' }
  ] as const

  for (const route of routes) {
    const response = await app.inject({
      ...route,
      headers: { 'X-AISSS-User-Id': regularUserId }
    })
    assert.equal(response.statusCode, 403, `${route.method} ${route.url}`)
  }
})
