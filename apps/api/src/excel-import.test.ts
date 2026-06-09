import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTemplateWorkbook, parseWorkbook } from './services/excel-import.js'

test('buildTemplateWorkbook and parseWorkbook round-trip sample row', () => {
  const buffer = buildTemplateWorkbook()
  const rows = parseWorkbook(buffer)
  assert.ok(rows.length >= 1)
  assert.equal(rows[0].title, 'サンプル表題')
  assert.equal(rows[0].material_type, '報告書')
})
