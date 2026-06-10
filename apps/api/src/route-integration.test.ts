import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { S3Client } from '@aws-sdk/client-s3'
import pg from 'pg'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'
import { runMigrations } from './db/migrate.js'
import type { Settings } from './settings.js'

const databaseUrl = process.env.INTEGRATION_DATABASE_URL
const moduleDir = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.resolve(moduleDir, '../../../infra/migrations')

const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000001'
const PILOT_USER_ID = '00000000-0000-4000-8000-000000000003'
const PUBLIC_CASE_DISPLAY_ID = 'CASE-2026-00142'
const RESTRICTED_CASE_DISPLAY_ID = 'CASE-2026-00138'
const RESTRICTED_CASE_ID = '07700000-0000-4000-8000-000000000138'

type IntegrationContext = {
  app: FastifyInstance
  pool: pg.Pool
}

async function createIntegrationContext (): Promise<IntegrationContext> {
  const pool = new pg.Pool({ connectionString: databaseUrl })
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
    devUserId: null,
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
  return { app, pool }
}

function authHeaders (userId: string): Record<string, string> {
  return { 'X-AISSS-User-Id': userId }
}

test('integration: admin GET /api/cases returns seeded cases', { skip: !databaseUrl }, async (t) => {
  const { app, pool } = await createIntegrationContext()
  t.after(async () => {
    await app.close()
    await pool.end()
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/cases',
    headers: authHeaders(ADMIN_USER_ID)
  })

  assert.equal(response.statusCode, 200)
  const body = response.json() as { items: Array<{ display_id: string }> }
  assert.ok(body.items.some((item) => item.display_id === PUBLIC_CASE_DISPLAY_ID))
  assert.ok(body.items.some((item) => item.display_id === RESTRICTED_CASE_DISPLAY_ID))
})

test('integration: pilot user sees all-users case only', { skip: !databaseUrl }, async (t) => {
  const { app, pool } = await createIntegrationContext()
  t.after(async () => {
    await app.close()
    await pool.end()
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/cases',
    headers: authHeaders(PILOT_USER_ID)
  })

  assert.equal(response.statusCode, 200)
  const body = response.json() as { items: Array<{ display_id: string }> }
  const displayIds = body.items.map((item) => item.display_id)
  assert.ok(displayIds.includes(PUBLIC_CASE_DISPLAY_ID))
  assert.equal(displayIds.includes(RESTRICTED_CASE_DISPLAY_ID), false)
})

test('integration: pilot user cannot open restricted case detail', { skip: !databaseUrl }, async (t) => {
  const { app, pool } = await createIntegrationContext()
  t.after(async () => {
    await app.close()
    await pool.end()
  })

  const response = await app.inject({
    method: 'GET',
    url: `/api/cases/${RESTRICTED_CASE_ID}`,
    headers: authHeaders(PILOT_USER_ID)
  })

  assert.equal(response.statusCode, 403)
})

test('integration: admin audit route returns audit rows', { skip: !databaseUrl }, async (t) => {
  const { app, pool } = await createIntegrationContext()
  t.after(async () => {
    await app.close()
    await pool.end()
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/audit-logs',
    headers: authHeaders(ADMIN_USER_ID)
  })

  assert.equal(response.statusCode, 200)
  const body = response.json() as { items: unknown[] }
  assert.ok(Array.isArray(body.items))
})
