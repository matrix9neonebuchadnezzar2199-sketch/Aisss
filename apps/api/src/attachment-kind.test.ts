import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectAttachmentKind, sourceTypeForKind } from './lib/attachment-kind.js'

test('detectAttachmentKind classifies common types', () => {
  assert.equal(detectAttachmentKind('report.pdf', 'application/pdf'), 'pdf')
  assert.equal(detectAttachmentKind('notes.txt', 'text/plain'), 'text')
  assert.equal(detectAttachmentKind('scan.png', 'image/png'), 'image')
  assert.equal(detectAttachmentKind('meeting.mp3', 'audio/mpeg'), 'audio')
  assert.equal(detectAttachmentKind('sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), 'office')
})

test('sourceTypeForKind maps to ingestion source types', () => {
  assert.equal(sourceTypeForKind('pdf'), 'pdf_parse')
  assert.equal(sourceTypeForKind('image'), 'ocr')
})
