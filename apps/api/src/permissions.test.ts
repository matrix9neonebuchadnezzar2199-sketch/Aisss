import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canAccessCase, isAdmin, isOperator } from './services/permissions.js'
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

const viewer: AuthUser = {
  id: '3',
  externalId: null,
  displayName: 'Viewer',
  departmentId: null,
  role: 'general',
  groupIds: ['g2'],
  viewingRangeIds: ['vr-public']
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

test('admin intentionally has all viewing-range access for operations', () => {
  assert.equal(canAccessCase(admin, ['vr-never-assigned']), true)
})

test('isOperator gates operational screens to elevated roles', () => {
  assert.equal(isOperator(admin), true)
  assert.equal(isOperator(analyst), true)
  assert.equal(isOperator(viewer), false)
})
