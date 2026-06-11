import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AppError } from './lib/errors.js'
import {
  computeReindexPercent,
  probeEmbeddingModel,
  startReindex
} from './services/embedding-reindex.js'
import type { Settings } from './settings.js'
import type { AuthUser } from './types/auth.js'

const admin: AuthUser = {
  id: 'admin-id',
  externalId: null,
  displayName: 'Admin',
  departmentId: null,
  role: 'admin',
  groupIds: [],
  viewingRangeIds: []
}

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

test('computeReindexPercent returns rounded percentage capped at 100', () => {
  assert.equal(computeReindexPercent(0, 0), 0)
  assert.equal(computeReindexPercent(5, 10), 50)
  assert.equal(computeReindexPercent(10, 10), 100)
  assert.equal(computeReindexPercent(999, 10), 100)
})

test('probeEmbeddingModel returns vector length from embed function', async () => {
  const dims = await probeEmbeddingModel('http://ollama', 'test-model', async () => [0.1, 0.2, 0.3])
  assert.equal(dims, 3)
})

test('probeEmbeddingModel throws 400 AppError when embed fails', async () => {
  await assert.rejects(
    () => probeEmbeddingModel('http://ollama', 'bad-model', async () => {
      throw new Error('model does not support embeddings')
    }),
    (error: unknown) => {
      assert.ok(error instanceof AppError)
      assert.equal(error.statusCode, 400)
      return true
    }
  )
})

test('startReindex rejects when another job is pending', async () => {
  const pool = {
    query: async (sql: string) => {
      if (sql.includes("status IN ('pending', 'running')")) {
        return { rows: [{ id: 'existing' }] }
      }
      throw new Error(`unexpected query: ${sql}`)
    }
  } as never

  await assert.rejects(
    () => startReindex(pool, settings, admin, 'new-embed'),
    (error: unknown) => {
      assert.ok(error instanceof AppError)
      assert.equal(error.statusCode, 409)
      return true
    }
  )
})
