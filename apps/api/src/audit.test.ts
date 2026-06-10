import { test } from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import { buildApp } from './app.js'
import type { Settings } from './settings.js'

const adminUserId = '00000000-0000-4000-8000-000000000001'

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

function createAuditCsvPool (): pg.Pool {
  return {
    connect: async () => ({
      query: async () => ({ rows: [{ '?column?': 1 }] }),
      release: () => {}
    }),
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        assert.equal(params[0], adminUserId)
        return {
          rows: [{
            id: adminUserId,
            external_id: 'admin',
            display_name: '開発管理者',
            department_id: null,
            role: 'admin'
          }]
        }
      }
      if (sql.includes('FROM user_groups')) {
        return { rows: [] }
      }
      if (sql.includes('FROM audit_logs al')) {
        return {
          rows: [{
            created_at: new Date('2026-06-10T06:00:00.000Z'),
            user_name: 'パイロット利用者',
            action: 'case.create',
            resource_type: 'case',
            resource_id: '00000000-0000-4000-8000-000000000099',
            case_display_id: 'CASE-2026-00142',
            query_id: null
          }]
        }
      }
      throw new Error(`unexpected query in audit CSV test: ${sql}`)
    },
    end: async () => {}
  } as unknown as pg.Pool
}

test('audit CSV export starts with UTF-8 BOM', async (t) => {
  const app = await buildApp({
    settings,
    pool: createAuditCsvPool(),
    storage: {} as never
  })
  t.after(async () => { await app.close() })

  const response = await app.inject({
    method: 'GET',
    url: '/api/audit-logs?export=csv',
    headers: { 'X-AISSS-User-Id': adminUserId }
  })

  assert.equal(response.statusCode, 200)
  assert.ok(response.body.startsWith('\uFEFF'), 'CSV should start with UTF-8 BOM')
  assert.match(response.headers['content-type'] ?? '', /text\/csv/)
  assert.match(response.body, /パイロット利用者/)
})
