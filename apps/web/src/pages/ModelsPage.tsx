import { useCallback, useEffect, useState } from 'react'
import {
  fetchOllamaHealth,
  fetchOllamaModels,
  saveModelRoles,
  type OllamaModelsResponse
} from '../lib/api'

type ModelRow = {
  name: string
  enabled_for_chat: boolean
  is_default_chat: boolean
  is_default_embedding: boolean
  is_rerank: boolean
}

function mapModelsResponse (m: OllamaModelsResponse): ModelRow[] {
  return m.models.map((x) => ({
    name: x.name,
    enabled_for_chat: x.enabled_for_chat,
    is_default_chat: x.is_default_chat,
    is_default_embedding: x.is_default_embedding,
    is_rerank: x.is_rerank
  }))
}

export function ModelsPage () {
  const [models, setModels] = useState<ModelRow[]>([])
  const [rerankEnabled, setRerankEnabled] = useState(false)
  const [health, setHealth] = useState('unknown')
  const [latency, setLatency] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)

  const reloadFromOllama = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const [m, h] = await Promise.all([fetchOllamaModels(), fetchOllamaHealth()])
      setModels(mapModelsResponse(m))
      setRerankEnabled(m.defaults.rerank_enabled)
      setHealth(h.status)
      setLatency(h.latency_ms)
    } catch (e) {
      setError(e instanceof Error ? e.message : '一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reloadFromOllama()
  }, [reloadFromOllama])

  function updateModel (name: string, patch: Partial<ModelRow>) {
    setSaved(false)
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
      await reloadFromOllama()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失敗')
    }
  }

  const enabledChatCount = models.filter((m) => m.enabled_for_chat).length

  return (
    <section className="view active" id="view-models">
      <div className="panel">
        <div className="panel-header">
          <div className="panel-header-title-row">
            <h2>モデル管理</h2>
            <button
              type="button"
              className="btn btn-sm"
              disabled={loading}
              onClick={() => void reloadFromOllama()}
            >
              {loading ? '取得中…' : 'Ollama から一覧更新'}
            </button>
          </div>
          <div className="label-row">
            <span className={`label label-${health === 'ok' ? 'success' : 'danger'}`}>
              Ollama: {health}{latency != null ? ` (${latency}ms)` : ''}
            </span>
            <span className="label label-default">{models.length} モデル</span>
            <span className="label label-info">チャット有効 {enabledChatCount}</span>
          </div>
          <p className="rag-register-note models-page-note">
            一覧は保存時・更新ボタン押下時に Ollama の <code>/api/tags</code> から取得します。pull した新モデルは「一覧更新」を押してください。
          </p>
        </div>
        <div className="panel-body">
          <table className="data-table models-table">
            <thead>
              <tr>
                <th scope="col">モデル</th>
                <th scope="col">チャット有効</th>
                <th scope="col">既定チャット</th>
                <th scope="col">既定埋め込み</th>
                <th scope="col">ReRank</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr
                  key={m.name}
                  className={[
                    m.enabled_for_chat ? 'model-row-chat-enabled' : '',
                    m.is_default_chat ? 'model-row-default-chat' : ''
                  ].filter(Boolean).join(' ')}
                >
                  <td>{m.name}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={m.enabled_for_chat}
                      aria-label={`${m.name} をチャット有効`}
                      onChange={(e) => updateModel(m.name, {
                        enabled_for_chat: e.target.checked,
                        ...(e.target.checked ? {} : { is_default_chat: false })
                      })}
                    />
                  </td>
                  <td>
                    <input
                      type="radio"
                      name="default_chat"
                      checked={m.is_default_chat}
                      aria-label={`${m.name} を既定チャット`}
                      onChange={() => updateModel(m.name, { is_default_chat: true, enabled_for_chat: true })}
                    />
                  </td>
                  <td>
                    <input
                      type="radio"
                      name="default_embed"
                      checked={m.is_default_embedding}
                      aria-label={`${m.name} を既定埋め込み`}
                      onChange={() => updateModel(m.name, { is_default_embedding: true })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={m.is_rerank}
                      aria-label={`${m.name} を ReRank`}
                      onChange={(e) => updateModel(m.name, { is_rerank: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <label className="rerank-toggle" style={{ display: 'block', marginTop: 12 }}>
            <input type="checkbox" checked={rerankEnabled} onChange={(e) => { setRerankEnabled(e.target.checked); setSaved(false) }} />
            ReRank を有効化（既定: off）
          </label>

          {error && <p className="error">{error}</p>}
          {saved && <p className="meta">設定を保存しました（AI 検索のモデル一覧に反映されます）</p>}
          <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => void onSave()}>
            設定を保存
          </button>
        </div>
      </div>
    </section>
  )
}
