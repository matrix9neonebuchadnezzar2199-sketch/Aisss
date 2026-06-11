import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { embedText } from './services/ollama-client.js'

test('embedText uses /api/embed with input and reads embeddings[0]', async () => {
  const fetchMock = mock.fn(async (url: string | URL, init?: RequestInit) => {
    assert.equal(String(url).endsWith('/api/embed'), true)
    const body = JSON.parse(String(init?.body)) as { model: string; input: string }
    assert.equal(body.model, 'test-embed')
    assert.equal(body.input, 'hello')
    return new Response(JSON.stringify({ embeddings: [[0.1, 0.2, 0.3]] }), { status: 200 })
  })
  mock.method(globalThis, 'fetch', fetchMock)

  const vector = await embedText('http://ollama:11434', 'test-embed', 'hello')
  assert.deepEqual(vector, [0.1, 0.2, 0.3])
  assert.equal(fetchMock.mock.callCount(), 1)

  mock.restoreAll()
})

test('embedText falls back to /api/embeddings when /api/embed returns 404', async () => {
  const fetchMock = mock.fn(async (url: string | URL) => {
    if (String(url).endsWith('/api/embed')) {
      return new Response('not found', { status: 404 })
    }
    return new Response(JSON.stringify({ embedding: [1, 2] }), { status: 200 })
  })
  mock.method(globalThis, 'fetch', fetchMock)

  const vector = await embedText('http://ollama:11434', 'legacy-embed', 'probe')
  assert.deepEqual(vector, [1, 2])
  assert.equal(fetchMock.mock.callCount(), 2)

  mock.restoreAll()
})

test('embedText includes Ollama error body in message', async () => {
  const fetchMock = mock.fn(async () => {
    return new Response(JSON.stringify({ error: 'model does not support embeddings' }), { status: 500 })
  })
  mock.method(globalThis, 'fetch', fetchMock)

  await assert.rejects(
    () => embedText('http://ollama:11434', 'bad-model', 'probe'),
    (error: unknown) => {
      assert.match(String(error), /model does not support embeddings/)
      return true
    }
  )

  mock.restoreAll()
})
