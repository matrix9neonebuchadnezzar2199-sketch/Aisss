import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canAccessCase, isAdmin } from './services/permissions.js'
import type { AuthUser } from './types/auth.js'

const admin: AuthUser = {
  id: '1',
  externalId: null,
  displayName: 'Admin',
  departmentId: null,
  role: 'admin',
  groupIds: [],
  viewingRangeIds: []
}

const analyst: AuthUser = {
  id: '2',
  externalId: null,
  displayName: 'Analyst',
  departmentId: null,
  role: 'operator',
  groupIds: ['g1'],
  viewingRangeIds: ['vr-analyst']
}

test('isAdmin detects admin role', () => {
  assert.equal(isAdmin(admin), true)
  assert.equal(isAdmin(analyst), false)
})

test('canAccessCase respects viewing range overlap', () => {
  assert.equal(canAccessCase(admin, []), true)
  assert.equal(canAccessCase(analyst, ['vr-analyst']), true)
  assert.equal(canAccessCase(analyst, ['vr-other']), false)
})
