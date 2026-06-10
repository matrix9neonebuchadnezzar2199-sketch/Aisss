import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildViewingRangeFilter } from './services/qdrant.js'
import { ALL_USERS_VIEWING_RANGE_ID } from './lib/viewing-ranges.js'

test('buildViewingRangeFilter limits admin users to rag-enabled chunks', () => {
  assert.deepEqual(
    buildViewingRangeFilter(['range-a'], true),
    { must: [{ key: 'rag_enabled', match: { value: true } }] }
  )
})

test('buildViewingRangeFilter still allows all-users range for users with no assigned ranges', () => {
  assert.deepEqual(
    buildViewingRangeFilter([], false),
    {
      must: [
        { key: 'rag_enabled', match: { value: true } },
        { key: 'viewing_range_ids', match: { any: [ALL_USERS_VIEWING_RANGE_ID] } }
      ]
    }
  )
})

test('buildViewingRangeFilter requires rag_enabled and any user or all-users viewing range', () => {
  assert.deepEqual(
    buildViewingRangeFilter(['range-a', 'range-b'], false),
    {
      must: [
        { key: 'rag_enabled', match: { value: true } },
        { key: 'viewing_range_ids', match: { any: ['range-a', 'range-b', ALL_USERS_VIEWING_RANGE_ID] } }
      ]
    }
  )
})
