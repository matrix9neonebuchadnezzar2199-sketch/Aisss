export async function embedText (baseUrl, model, text) {
  const response = await fetch(new URL('/api/embeddings', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: text })
  })
  if (!response.ok) {
    throw new Error(`Ollama embeddings HTTP ${response.status}`)
  }
  const body = await response.json()
  if (!body.embedding?.length) throw new Error('Empty embedding from Ollama')
  return body.embedding
}
