import { useEffect, useState } from 'react'

type HealthResponse = {
  status: string
  service: string
  database: boolean
}

type OllamaHealthResponse = {
  status: string
  latency_ms: number | null
}

export function ApiStatus () {
  const [api, setApi] = useState<HealthResponse | null>(null)
  const [ollama, setOllama] = useState<OllamaHealthResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load () {
      try {
        const [healthRes, ollamaRes] = await Promise.all([
          fetch('/api/health'),
          fetch('/api/ollama/health')
        ])
        if (cancelled) return
        if (healthRes.ok) setApi(await healthRes.json())
        if (ollamaRes.ok) setOllama(await ollamaRes.json())
      } catch {
        if (!cancelled) {
          setApi(null)
          setOllama(null)
        }
      }
    }

    void load()
    const timer = window.setInterval(load, 30000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return (
    <div className="api-status">
      <span data-status={api?.status ?? 'unknown'}>
        API: {api?.status ?? 'unreachable'}
        {api ? ` / DB ${api.database ? 'ok' : 'down'}` : ''}
      </span>
      <span data-status={ollama?.status ?? 'unknown'}>
        Ollama: {ollama?.status ?? 'unreachable'}
        {ollama?.latency_ms != null ? ` (${ollama.latency_ms}ms)` : ''}
      </span>
    </div>
  )
}
