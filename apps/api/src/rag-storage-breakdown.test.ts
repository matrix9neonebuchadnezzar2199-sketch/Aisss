import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  categoryFromAttachmentKind,
  categoryFromSourceType
} from './services/rag-storage-breakdown.js'

test('categoryFromSourceType maps extraction engines to dashboard buckets', () => {
  assert.equal(categoryFromSourceType('case_body'), 'case_text')
  assert.equal(categoryFromSourceType('office_parse'), 'office')
  assert.equal(categoryFromSourceType('pdf_parse'), 'pdf')
  assert.equal(categoryFromSourceType('asr'), 'audio')
  assert.equal(categoryFromSourceType('ocr'), 'image')
  assert.equal(categoryFromSourceType('manual_text'), null)
})

test('categoryFromAttachmentKind maps attachment kinds to dashboard buckets', () => {
  assert.equal(categoryFromAttachmentKind('office'), 'office')
  assert.equal(categoryFromAttachmentKind('pdf'), 'pdf')
  assert.equal(categoryFromAttachmentKind('audio'), 'audio')
  assert.equal(categoryFromAttachmentKind('image'), 'image')
  assert.equal(categoryFromAttachmentKind('text'), null)
  assert.equal(categoryFromAttachmentKind('other'), null)
})
