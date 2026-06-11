import { test } from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import { deleteJobsForAttachment } from './services/job-cleanup.js'
import { syncCaseKeywords } from './services/case-keywords.js'

test('M22: deleteJobsForAttachment clears FK blockers before attachment delete', async () => {
  const statements: string[] = []
  const pool = {
    query: async (sql: string) => {
      statements.push(sql.replace(/\s+/g, ' ').trim())
      return { rows: [] }
    }
  } as unknown as pg.Pool

  await deleteJobsForAttachment(pool, 'att-m22')

  assert.equal(statements.length, 2)
  assert.match(statements[0], /DELETE FROM jobs WHERE attachment_id/)
  assert.match(statements[1], /payload_json->>'attachment_id'/)
})

test('M22: syncCaseKeywords replaces join rows', async () => {
  const statements: string[] = []
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      statements.push(sql.replace(/\s+/g, ' ').trim())
      if (sql.includes('SELECT id FROM keywords')) {
        return { rows: [] }
      }
      if (sql.includes('INSERT INTO keywords')) {
        return { rows: [{ id: 'kw-1' }] }
      }
      return { rows: [] }
    }
  } as unknown as pg.Pool

  await syncCaseKeywords(pool, 'case-1', ['alpha', 'beta'])

  assert.ok(statements.some((s) => s.includes('DELETE FROM case_keywords')))
  assert.ok(statements.some((s) => s.includes('INSERT INTO case_keywords')))
})
