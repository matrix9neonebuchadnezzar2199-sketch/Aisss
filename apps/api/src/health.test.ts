import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildApp } from './app.js'
import { checkOllamaHealth } from './services/ollama-health.js'

test('GET /api/health returns service payload', async (t) => {
  const pool = {
    connect: async () => ({
      query: async () => ({ rows: [{ '?column?': 1 }] }),
      release: () => {}
    }),
    end: async () => {}
  }

  const app = await buildApp({
    settings: {
      host: '127.0.0.1',
      port: 0,
      databaseUrl: 'postgresql://test@localhost/test',
      ollamaBaseUrl: 'http://localhost:11434',
      migrateOnStart: false,
      migrationsDir: '/tmp'
    },
    pool: pool as never
  })

  t.after(async () => {
    await app.close()
  })

  const response = await app.inject({ method: 'GET', url: '/api/health' })
  assert.equal(response.statusCode, 200)
  const body = response.json() as { service: string; status: string }
  assert.equal(body.service, 'aisss-api')
  assert.equal(body.status, 'ok')
})

test('checkOllamaHealth reports down when unreachable', async () => {
  const result = await checkOllamaHealth('http://127.0.0.1:1', 200)
  assert.equal(result.status, 'down')
  assert.ok(result.error)
})
