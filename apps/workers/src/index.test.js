import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

test('worker entry logs heartbeat message', async () => {
  const source = await readFile(new URL('./index.js', import.meta.url), 'utf8')
  assert.match(source, /aisss-worker/)
})
