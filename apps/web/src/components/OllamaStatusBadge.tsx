import { useEffect, useState } from 'react'
import { fetchOllamaHealth } from '../lib/api'

export function OllamaStatusBadge () {
  const [status, setStatus] = useState<'ok' | 'degraded' | 'down'>('down')
  const [label, setLabel] = useState('確認中…')

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      const health = await fetchOllamaHealth()
      if (cancelled) return
      const s = health.status === 'ok' ? 'ok' : health.status === 'degraded' ? 'degraded' : 'down'
      setStatus(s)
      setLabel(s === 'ok' ? '接続中' : s === 'degraded' ? '劣化' : '切断')
    }
    void poll()
    const id = window.setInterval(() => { void poll() }, 30_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <span className={`ollama-status ${status === 'degraded' ? 'degraded' : status === 'down' ? 'down' : ''}`} title="Ollama ホスト接続状態">
      <span className="dot" />
      <span>Ollama: {label}</span>
    </span>
  )
}
