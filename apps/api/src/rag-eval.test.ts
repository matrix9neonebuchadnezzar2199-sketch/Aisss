import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatEvalReport,
  loadRetrievalEvalSet,
  runRetrievalEval
} from './services/rag-eval.js'
import type { Settings } from './settings.js'

const settings: Settings = {
  host: '0.0.0.0',
  port: 8000,
  databaseUrl: 'postgres://test',
  ollamaBaseUrl: 'http://ollama',
  vectorDbUrl: 'http://qdrant',
  vectorCollection: 'aisss_chunks',
  migrateOnStart: false,
  migrationsDir: 'migrations',
  devUserId: null,
  objectStorage: {
    endpoint: 'http://minio',
    bucket: 'aisss',
    accessKey: 'test',
    secretKey: 'test'
  },
  maxUploadBytes: 1
}

test('retrieval eval set runs all permission scenarios', async () => {
  const evalSet = await loadRetrievalEvalSet()
  const report = await runRetrievalEval(settings, evalSet.scenarios)

  assert.equal(report.total, evalSet.scenarios.length)
  assert.equal(report.failed, 0, formatEvalReport(report))
  assert.ok(report.results.some((result) => result.id === 'deny-policy-block'))
  assert.ok(report.results.every((result) => result.pass))
})
