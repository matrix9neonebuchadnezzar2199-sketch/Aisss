import { test } from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import { AppError } from './lib/errors.js'
import { createCase, updateCase } from './services/cases.js'
import type { AuthUser } from './types/auth.js'

const user: AuthUser = {
  id: 'user-1',
  externalId: null,
  displayName: 'User',
  departmentId: null,
  role: 'operator',
  groupIds: [],
  viewingRangeIds: []
}

const pool = {
  connect () {
    throw new Error('validation should run before database access')
  },
  query () {
    throw new Error('validation should run before database access')
  }
} as unknown as pg.Pool

function isViewingRangeValidationError (error: unknown): boolean {
  return (
    error instanceof AppError &&
    error.code === 'validation_error' &&
    error.statusCode === 400 &&
    error.message.includes('viewing_range_ids')
  )
}

test('createCase requires at least one viewing range', async () => {
  await assert.rejects(
    createCase(pool, user, { title: 'Missing range' }),
    isViewingRangeValidationError
  )
})

test('updateCase rejects clearing every viewing range', async () => {
  await assert.rejects(
    updateCase(pool, user, 'case-1', { viewing_range_ids: [] }),
    isViewingRangeValidationError
  )
})
