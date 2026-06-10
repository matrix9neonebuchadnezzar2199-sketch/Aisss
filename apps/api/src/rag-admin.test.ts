import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveRagVisibilityState } from './services/rag-admin.js'

test('resolveRagVisibilityState labels rag-enabled attachments', () => {
  const result = resolveRagVisibilityState({
    rag_enabled: true,
    auto_enable_rag_on_extraction: false,
    extraction_status: 'succeeded'
  })
  assert.equal(result.state, 'rag_enabled')
  assert.equal(result.label, 'RAG有効')
  assert.equal(result.is_knowledge_candidate, false)
})

test('resolveRagVisibilityState labels auto-enable reservation', () => {
  const result = resolveRagVisibilityState({
    rag_enabled: false,
    auto_enable_rag_on_extraction: true,
    extraction_status: 'succeeded'
  })
  assert.equal(result.state, 'auto_enable_reserved')
  assert.equal(result.label, '自動ON予約')
  assert.equal(result.is_knowledge_candidate, false)
})

test('resolveRagVisibilityState labels extracted-but-not-enabled candidates', () => {
  const result = resolveRagVisibilityState({
    rag_enabled: false,
    auto_enable_rag_on_extraction: false,
    extraction_status: 'succeeded'
  })
  assert.equal(result.state, 'knowledge_candidate')
  assert.equal(result.label, '未ナレッジ化候補')
  assert.equal(result.is_knowledge_candidate, true)
})

test('resolveRagVisibilityState labels extraction failures', () => {
  const result = resolveRagVisibilityState({
    rag_enabled: false,
    auto_enable_rag_on_extraction: true,
    extraction_status: 'failed'
  })
  assert.equal(result.state, 'extraction_failed')
  assert.equal(result.label, '抽出失敗')
})
