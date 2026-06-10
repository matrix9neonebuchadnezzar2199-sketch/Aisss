import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chunkText } from './chunk.js'

test('chunkText returns no chunks for empty or whitespace text', () => {
  assert.deepEqual(chunkText('', 10, 2), [])
  assert.deepEqual(chunkText('   \r\n  ', 10, 2), [])
})

test('chunkText returns one chunk for text exactly at chunk size', () => {
  assert.deepEqual(chunkText('abcdefghij', 10, 2), ['abcdefghij'])
})

test('chunkText creates overlapped chunks for text over chunk size', () => {
  assert.deepEqual(chunkText('abcdefghijk', 10, 2), ['abcdefghij', 'ijk'])
})

test('chunkText normalizes CRLF line endings', () => {
  assert.deepEqual(chunkText('a\r\nb', 10, 2), ['a\nb'])
})

test('chunkText keeps moving forward when overlap is greater than chunk size', () => {
  assert.deepEqual(chunkText('abcdef', 3, 99), ['abc', 'bcd', 'cde', 'def'])
})

test('chunkText rejects non-positive chunk size', () => {
  assert.throws(() => chunkText('abc', 0, 0), /chunkSize/)
})
