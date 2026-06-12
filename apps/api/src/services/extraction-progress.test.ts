import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildExtractionProgress, estimateExtractionSeconds } from './extraction-progress.js'

test('estimateExtractionSeconds scales with PDF size', () => {
  const small = estimateExtractionSeconds(200_000, 'doc.pdf')
  const large = estimateExtractionSeconds(5_000_000, 'doc.pdf')
  assert.ok(large > small)
})

test('buildExtractionProgress returns queued state for pending extraction', () => {
  const now = new Date('2026-06-12T10:00:30.000Z')
  const created = new Date('2026-06-12T10:00:00.000Z')
  const progress = buildExtractionProgress({
    extraction_status: 'pending',
    job_status: 'pending',
    job_created_at: created,
    job_updated_at: created,
    file_size_bytes: 1_000_000,
    file_name: 'sample.pdf',
    now
  })
  assert.ok(progress)
  assert.equal(progress.phase, 'queued')
  assert.ok(progress.percent <= 15)
  assert.equal(progress.elapsed_seconds, 30)
})

test('buildExtractionProgress returns running progress with ETA', () => {
  const now = new Date('2026-06-12T10:01:00.000Z')
  const started = new Date('2026-06-12T10:00:00.000Z')
  const progress = buildExtractionProgress({
    extraction_status: 'running',
    job_status: 'running',
    job_created_at: started,
    job_updated_at: started,
    file_size_bytes: 1_000_000,
    file_name: 'sample.pdf',
    now
  })
  assert.ok(progress)
  assert.equal(progress.phase, 'running')
  assert.ok(progress.percent >= 18)
  assert.ok(progress.eta_seconds >= 0)
  assert.equal(progress.elapsed_seconds, 60)
})
