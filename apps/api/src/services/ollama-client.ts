import { AppError } from '../lib/errors.js'

export async function embedText (
  baseUrl: string,
  model: string,
  text: string
): Promise<number[]> {
  const response = await fetch(new URL('/api/embeddings', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text })
  })
  if (!response.ok) {
    throw new AppError('ollama_error', `Ollama embeddings failed: HTTP ${response.status}`, 502)
  }
  const body = await response.json() as { embedding?: number[] }
  if (!body.embedding?.length) {
    throw new AppError('ollama_error', 'Ollama returned empty embedding.', 502)
  }
  return body.embedding
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
