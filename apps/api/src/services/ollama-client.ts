import { AppError } from '../lib/errors.js'

type OllamaEmbedResponse = {
  embeddings?: number[][]
  embedding?: number[]
}

async function readOllamaErrorDetail (response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string }
    if (typeof body.error === 'string' && body.error.trim()) {
      return `${response.status}: ${body.error.trim()}`
    }
  } catch {
    // 本文が JSON でない場合は status のみ
  }
  return `HTTP ${response.status}`
}

function extractEmbeddingVector (body: OllamaEmbedResponse): number[] | null {
  const fromBatch = body.embeddings?.[0]
  if (fromBatch?.length) return fromBatch
  if (body.embedding?.length) return body.embedding
  return null
}

/** Ollama `/api/embed`（現行）→ 404 時のみ legacy `/api/embeddings` にフォールバック */
export async function embedText (
  baseUrl: string,
  model: string,
  text: string
): Promise<number[]> {
  const embedResponse = await fetch(new URL('/api/embed', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: text })
  })

  if (embedResponse.ok) {
    const body = await embedResponse.json() as OllamaEmbedResponse
    const vector = extractEmbeddingVector(body)
    if (vector) return vector
    throw new AppError('ollama_error', 'Ollama returned empty embedding.', 502)
  }

  if (embedResponse.status !== 404) {
    const detail = await readOllamaErrorDetail(embedResponse)
    throw new AppError('ollama_error', `Ollama embed failed: ${detail}`, 502)
  }

  const legacyResponse = await fetch(new URL('/api/embeddings', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text })
  })
  if (!legacyResponse.ok) {
    const detail = await readOllamaErrorDetail(legacyResponse)
    throw new AppError('ollama_error', `Ollama embeddings failed: ${detail}`, 502)
  }
  const legacyBody = await legacyResponse.json() as OllamaEmbedResponse
  const legacyVector = extractEmbeddingVector(legacyBody)
  if (!legacyVector) {
    throw new AppError('ollama_error', 'Ollama returned empty embedding.', 502)
  }
  return legacyVector
}

export async function chatCompletion (
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await fetch(new URL('/api/chat', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    })
  })
  if (!response.ok) {
    throw new AppError('ollama_error', `Ollama chat failed: HTTP ${response.status}`, 502)
  }
  const body = await response.json() as { message?: { content?: string } }
  return body.message?.content?.trim() ?? ''
}

/** ホスト Ollama からモデルバイナリを削除する。 */
export async function deleteOllamaModel (baseUrl: string, model: string): Promise<void> {
  const response = await fetch(new URL('/api/delete', baseUrl), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model })
  })
  if (!response.ok) {
    throw new AppError('ollama_error', `Ollama delete failed: HTTP ${response.status}`, 502)
  }
}

export async function* chatCompletionStream (
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userMessage: string
): AsyncGenerator<string> {
  const response = await fetch(new URL('/api/chat', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    })
  })
  if (!response.ok || !response.body) {
    throw new AppError('ollama_error', `Ollama chat stream failed: HTTP ${response.status}`, 502)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const json = JSON.parse(trimmed) as { message?: { content?: string }; done?: boolean }
        if (json.message?.content) yield json.message.content
      } catch {
        // skip malformed stream lines
      }
    }
  }
}
