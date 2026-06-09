import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeEffectivePolicies,
  isSearchDenied
} from './services/conditions.js'

test('照会禁止 denies search', () => {
  assert.equal(
    isSearchDenied([{
      name: '照会禁止',
      search_policy: 'deny',
      quote_policy: 'deny',
      export_policy: 'deny_all',
      priority: 20
    }]),
    true
  )
})

test('computeEffectivePolicies picks most restrictive', () => {
  const policies = computeEffectivePolicies([
    {
      name: '印刷禁止',
      search_policy: 'allow',
      quote_policy: 'allow',
      export_policy: 'deny_print',
      priority: 10
    },
    {
      name: '複製禁止',
      search_policy: 'allow',
      quote_policy: 'summarize_only',
      export_policy: 'deny_copy',
      priority: 10
    }
  ])
  assert.equal(policies.quote_policy, 'summarize_only')
  assert.equal(policies.export_policy, 'deny_copy')
})
