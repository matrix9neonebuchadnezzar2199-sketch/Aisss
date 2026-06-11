import { test } from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import {
  deleteJobsForAttachment,
  deleteJobsForStandaloneFile
} from './services/job-cleanup.js'

test('deleteJobsForAttachment removes rows by column and payload', async () => {
  const statements: string[] = []
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      statements.push(sql.replace(/\s+/g, ' ').trim())
      assert.equal(params?.[0], 'att-1')
      return { rows: [] }
    }
  } as unknown as pg.Pool

  await deleteJobsForAttachment(pool, 'att-1')

  assert.equal(statements.length, 2)
  assert.match(statements[0], /DELETE FROM jobs WHERE attachment_id/)
  assert.match(statements[1], /payload_json->>'attachment_id'/)
})

test('deleteJobsForStandaloneFile removes payload-linked jobs', async () => {
  const statements: string[] = []
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      statements.push(sql.replace(/\s+/g, ' ').trim())
      assert.equal(params?.[0], 'sf-1')
      return { rows: [] }
    }
  } as unknown as pg.Pool

  await deleteJobsForStandaloneFile(pool, 'sf-1')

  assert.equal(statements.length, 1)
  assert.match(statements[0], /payload_json->>'standalone_file_id'/)
})
