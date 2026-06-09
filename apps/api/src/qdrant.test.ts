import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildViewingRangeFilter } from './services/qdrant.js'

test('buildViewingRangeFilter returns undefined for admin users', () => {
  assert.equal(buildViewingRangeFilter(['range-a'], true), undefined)
})

test('buildViewingRangeFilter returns non-matching filter for users with no viewing ranges', () => {
  assert.deepEqual(
    buildViewingRangeFilter([], false),
    { must: [{ key: 'viewing_range_ids', match: { any: ['__none__'] } }] }
  )
})

test('buildViewingRangeFilter requires rag_enabled and any matching viewing range', () => {
  assert.deepEqual(
    buildViewingRangeFilter(['range-a', 'range-b'], false),
    {
      must: [
        { key: 'rag_enabled', match: { value: true } },
        { key: 'viewing_range_ids', match: { any: ['range-a', 'range-b'] } }
      ]
    }
  )
})
