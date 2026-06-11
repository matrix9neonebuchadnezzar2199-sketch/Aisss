import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { extractText } from './extract.js'

test('extractText reads plain text files', async () => {
  const result = await extractText(
    { attachment_kind: 'text', file_name: 'notes.txt' },
    Buffer.from('hello attachment', 'utf8')
  )
  assert.equal(result.text, 'hello attachment')
  assert.equal(result.engine, 'utf8')
})

test('extractText reads xlsx workbook sheets as csv text', async () => {
  const sheet = XLSX.utils.aoa_to_sheet([['列A', '列B'], ['値1', '値2']])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  const result = await extractText(
    { attachment_kind: 'office', file_name: 'budget-table.xlsx' },
    buffer
  )
  assert.match(result.text, /値1/)
  assert.equal(result.engine, 'xlsx')
})
