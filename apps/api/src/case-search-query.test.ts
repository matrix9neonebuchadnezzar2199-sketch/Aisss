import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCaseSearchQuery } from './lib/case-search-query.js'

test('parseCaseSearchQuery maps extended filters', () => {
  const q = parseCaseSearchQuery({
    q: 'trade',
    title: '東アジア',
    material_number: 'MAT-1',
    category_id: 'cat-1',
    region_id: 'reg-1',
    source_id: 'src-1',
    information_request_id: 'ir-1',
    handling_type_id: 'ht-1',
    reliability_id: 'rel-1',
    accuracy_id: 'acc-1',
    condition_id: 'cond-1',
    event_date_from: '2026-01-01',
    event_date_to: '2026-12-31',
    page: '2',
    limit: '50',
    sort: 'title',
    order: 'asc'
  })
  assert.equal(q.q, 'trade')
  assert.equal(q.title, '東アジア')
  assert.equal(q.category_id, 'cat-1')
  assert.equal(q.event_date_from, '2026-01-01')
  assert.equal(q.page, 2)
  assert.equal(q.order, 'asc')
})

test('parseCaseSearchQuery skips empty values', () => {
  const q = parseCaseSearchQuery({ q: '  ', rank_id: '' })
  assert.deepEqual(q, {})
})
