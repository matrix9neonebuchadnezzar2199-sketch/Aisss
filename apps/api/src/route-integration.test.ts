import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { S3Client } from '@aws-sdk/client-s3'
import pg from 'pg'
import { buildApp } from './app.js'
import { runMigrations } from './db/migrate.js'
import type { Settings } from './settings.js'

const databaseUrl = process.env.INTEGRATION_DATABASE_URL
const moduleDir = path.dirname(fileURLToPath(import.meta.url))

test('integration: GET /api/cases returns a seeded case list', { skip: !databaseUrl }, async (t) => {
  const pool = new pg.Pool({ connectionString: databaseUrl })
  const migrationsDir = path.resolve(moduleDir, '../../../infra/migrations')
  await runMigrations(pool, migrationsDir)

  const settings: Settings = {
    host: '127.0.0.1',
    port: 0,
    databaseUrl: databaseUrl!,
    ollamaBaseUrl: 'http://localhost:11434',
    vectorDbUrl: 'http://vector:6333',
    vectorCollection: 'aisss_chunks',
    migrateOnStart: false,
    migrationsDir,
    devUserId: '00000000-0000-4000-8000-000000000001',
    objectStorage: {
      endpoint: 'http://localhost:9000',
      bucket: 'aisss',
      accessKey: 'test',
      secretKey: 'test'
    },
    maxUploadBytes: 1024
  }
  const app = await buildApp({
    settings,
    pool,
    storage: new S3Client({ region: 'us-east-1' })
  })

  t.after(async () => {
    await app.close()
    await pool.end()
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/cases',
    headers: { 'X-AISSS-User-Id': settings.devUserId! }
  })

  assert.equal(response.statusCode, 200)
  const body = response.json() as { items: Array<{ display_id: string }> }
  assert.ok(body.items.some((item) => item.display_id === 'CASE-2026-00142'))
})
