import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractText } from './extract.js'

test('extractText reads plain text files', async () => {
  const result = await extractText(
    { attachment_kind: 'text', file_name: 'notes.txt' },
    Buffer.from('hello attachment', 'utf8')
  )
  assert.equal(result.text, 'hello attachment')
  assert.equal(result.engine, 'utf8')
})
