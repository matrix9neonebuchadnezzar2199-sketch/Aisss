async function readOllamaErrorDetail (response) {
  try {
    const body = await response.json()
    if (typeof body.error === 'string' && body.error.trim()) {
      return `${response.status}: ${body.error.trim()}`
    }
  } catch {
    // ignore non-json body
  }
  return `HTTP ${response.status}`
}

function extractEmbeddingVector (body) {
  const fromBatch = body.embeddings?.[0]
  if (fromBatch?.length) return fromBatch
  if (body.embedding?.length) return body.embedding
  return null
}

/** Ollama `/api/embed`（現行）→ 404 時のみ legacy `/api/embeddings` にフォールバック */
export async function embedText (baseUrl, model, text) {
  const embedResponse = await fetch(new URL('/api/embed', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text })
  })

  if (embedResponse.ok) {
    const body = await embedResponse.json()
    const vector = extractEmbeddingVector(body)
    if (vector) return vector
    throw new Error('Empty embedding from Ollama')
  }

  if (embedResponse.status !== 404) {
    const detail = await readOllamaErrorDetail(embedResponse)
    throw new Error(`Ollama embed failed: ${detail}`)
  }

  const legacyResponse = await fetch(new URL('/api/embeddings', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text })
  })
  if (!legacyResponse.ok) {
    const detail = await readOllamaErrorDetail(legacyResponse)
    throw new Error(`Ollama embeddings failed: ${detail}`)
  }
  const legacyBody = await legacyResponse.json()
  const legacyVector = extractEmbeddingVector(legacyBody)
  if (!legacyVector) throw new Error('Empty embedding from Ollama')
  return legacyVector
}
