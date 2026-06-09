export type OllamaHealthStatus = 'ok' | 'degraded' | 'down'

export type OllamaHealthResponse = {
  status: OllamaHealthStatus
  latency_ms: number | null
  ollama_version: string | null
  checked_at: string
  error?: string
}

export async function checkOllamaHealth (
  baseUrl: string,
  timeoutMs = 5000
): Promise<OllamaHealthResponse> {
  const checkedAt = new Date().toISOString()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()

  try {
    const response = await fetch(new URL('/api/version', baseUrl), {
      signal: controller.signal
    })
    const latencyMs = Date.now() - started

    if (!response.ok) {
      return {
        status: 'down',
        latency_ms: latencyMs,
        ollama_version: null,
        checked_at: checkedAt,
        error: `HTTP ${response.status}`
      }
    }

    const body = await response.json() as { version?: string }
    return {
      status: latencyMs > 3000 ? 'degraded' : 'ok',
      latency_ms: latencyMs,
      ollama_version: body.version ?? null,
      checked_at: checkedAt
    }
  } catch (error) {
    return {
      status: 'down',
      latency_ms: null,
      ollama_version: null,
      checked_at: checkedAt,
      error: error instanceof Error ? error.message : 'unknown error'
    }
  } finally {
    clearTimeout(timer)
  }
}
