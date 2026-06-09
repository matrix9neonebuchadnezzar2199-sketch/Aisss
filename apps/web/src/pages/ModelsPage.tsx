import { useEffect, useState } from 'react'
import { fetchOllamaHealth, fetchOllamaModels, saveModelRoles } from '../lib/api'

type ModelRow = {
  name: string
  enabled_for_chat: boolean
  is_default_chat: boolean
  is_default_embedding: boolean
  is_rerank: boolean
}

export function ModelsPage () {
  const [models, setModels] = useState<ModelRow[]>([])
  const [rerankEnabled, setRerankEnabled] = useState(false)
  const [health, setHealth] = useState('unknown')
  const [latency, setLatency] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void Promise.all([fetchOllamaModels(), fetchOllamaHealth()]).then(([m, h]) => {
      setModels(m.models.map((x) => ({
        name: x.name,
        enabled_for_chat: x.enabled_for_chat,
        is_default_chat: x.is_default_chat,
        is_default_embedding: x.is_default_embedding,
        is_rerank: x.is_rerank
      })))
      setRerankEnabled(m.defaults.rerank_enabled)
      setHealth(h.status)
      setLatency(h.latency_ms)
    }).catch((e: Error) => setError(e.message))
  }, [])

  function updateModel (name: string, patch: Partial<ModelRow>) {
    setModels((rows) => rows.map((r) => {
      if (r.name !== name) {
        if (patch.is_default_chat) return { ...r, is_default_chat: false }
        if (patch.is_default_embedding) return { ...r, is_default_embedding: false }
        if (patch.is_rerank) return { ...r, is_rerank: false }
        return r
      }
      return { ...r, ...patch }
    }))
  }

  async function onSave () {
    setError(null)
    setSaved(false)
    try {
      await saveModelRoles({
        rerank_enabled: rerankEnabled,
        assignments: models.map((m) => ({
          model_name: m.name,
          roles: [
            ...(m.enabled_for_chat ? ['chat'] : []),
            ...(m.is_default_embedding ? ['embedding'] : []),
            ...(m.is_rerank ? ['rerank'] : [])
          ],
          enabled_for_chat: m.enabled_for_chat,
          is_default_chat: m.is_default_chat,
          is_default_embedding: m.is_default_embedding,
          is_rerank: m.is_rerank
        }))
      })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失敗')
    }
  }

  return (
    <section className="page">
      <h2>モデル管理（API 連携）</h2>
      <p className="meta">
        Ollama: {health}{latency != null ? ` (${latency}ms)` : ''}
      </p>

      <table className="data-table">
        <thead>
          <tr>
            <th>モデル</th>
            <th>チャット有効</th>
            <th>既定チャット</th>
            <th>既定埋め込み</th>
            <th>ReRank</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.name}>
              <td>{m.name}</td>
              <td>
                <input
                  type="checkbox"
                  checked={m.enabled_for_chat}
                  onChange={(e) => updateModel(m.name, { enabled_for_chat: e.target.checked })}
                />
              </td>
              <td>
                <input
                  type="radio"
                  name="default_chat"
                  checked={m.is_default_chat}
                  onChange={() => updateModel(m.name, { is_default_chat: true, enabled_for_chat: true })}
                />
              </td>
              <td>
                <input
                  type="radio"
                  name="default_embed"
                  checked={m.is_default_embedding}
                  onChange={() => updateModel(m.name, { is_default_embedding: true })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={m.is_rerank}
                  onChange={(e) => updateModel(m.name, { is_rerank: e.target.checked })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <label className="rerank-toggle">
        <input type="checkbox" checked={rerankEnabled} onChange={(e) => setRerankEnabled(e.target.checked)} />
        ReRank を有効化（既定: off）
      </label>

      {error && <p className="error">{error}</p>}
      {saved && <p className="meta">設定を保存しました</p>}
      <button type="button" onClick={() => void onSave()}>設定を保存</button>
    </section>
  )
}
